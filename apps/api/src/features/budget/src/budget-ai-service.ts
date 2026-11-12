import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import { BadGatewayException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const NONE = 'NONE';

type Category = { id: string; name: string };

export type ReceiptScan = { merchant: string | null; amount: number | null; currency: string | null; day: string | null; categoryId: string | null };
export type Insights = { headline: string; points: string[] };

const categoryChoice = (categories: Category[]) => z.enum([NONE, ...categories.map(({ name }) => name)]);

// Entry details only leave for Google when the server has a Gemini key, so the features are off by default.
// ponytail: no per-user rate limit on these calls; add one before opening sign-ups to strangers
@Injectable()
export class BudgetAiService {
  private readonly client = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

  get enabled(): boolean {
    return this.client !== null;
  }

  async categorize(categories: Category[], entry: { note: string; kind: string; amount: string }): Promise<string | null> {
    if (categories.length === 0) return null;
    const { category } = await this.ask(
      z.object({ category: categoryChoice(categories) }),
      "You sort one person's budget entries into their own categories. Pick the single category that best fits the entry. Answer NONE when no category is a reasonable fit; a wrong category is worse than none.",
      `Categories: ${categories.map(({ name }) => name).join(', ')}\n\n<entry>\n${entry.kind}, ${entry.amount}: ${entry.note}\n</entry>`,
    );
    return categories.find(({ name }) => name === category)?.id ?? null;
  }

  async scanReceipt(categories: Category[], image: { data: string; mediaType: string }, today: string): Promise<ReceiptScan> {
    const result = await this.ask(
      z.object({
        merchant: z.string().nullable(),
        total: z.number().nullable(),
        currency: z.string().nullable(),
        date: z.string().nullable(),
        category: categoryChoice(categories),
      }),
      'You read a photo of a receipt for a personal budget app. Report the shop or merchant name, the final total actually paid (after discounts, including tax and tip), its ISO 4217 currency code if the receipt shows or clearly implies one, and the purchase date as YYYY-MM-DD. Use null for anything you cannot read with confidence; never guess a number. Also pick the spending category that fits best, or NONE.',
      [
        { inlineData: { mimeType: image.mediaType, data: image.data } },
        { text: `Today is ${today}. Spending categories: ${categories.map(({ name }) => name).join(', ') || 'none'}.` },
      ],
    );
    return {
      merchant: result.merchant?.trim().slice(0, 80) || null,
      amount: result.total !== null && result.total > 0 && result.total < 1e11 ? Math.round(result.total * 100) : null,
      currency: result.currency && /^[A-Z]{3}$/.test(result.currency) ? result.currency : null,
      day: result.date && /^\d{4}-\d{2}-\d{2}$/.test(result.date) && result.date <= today ? result.date : null,
      categoryId: categories.find(({ name }) => name === result.category)?.id ?? null,
    };
  }

  async insights(summary: unknown): Promise<Insights> {
    const result = await this.ask(
      z.object({ headline: z.string(), points: z.array(z.string()) }),
      'You write a short monthly check-in for one person about their own budget, from the figures they give you. Write a one-sentence headline, then three to five observations of at most 30 words each: what changed from last month, categories over or near their limit, bills coming up, and one practical suggestion. Use only the figures given, quote amounts exactly as written, and do not recommend financial products. Plain, friendly, second person.',
      `<budget-summary>\n${JSON.stringify(summary)}\n</budget-summary>`,
    );
    return { headline: result.headline.slice(0, 300), points: result.points.slice(0, 5).map((point) => point.slice(0, 400)) };
  }

  // Asks for JSON in the schema's shape, then checks it again here: a reply that doesn't fit is an error, never used.
  private async ask<T extends z.ZodType>(schema: T, system: string, content: string | Part[]): Promise<z.infer<T>> {
    if (!this.client) throw new ServiceUnavailableException('AI features are off. Set GEMINI_API_KEY on the server to turn them on.');
    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: typeof content === 'string' ? [{ text: content }] : content }],
        config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(schema) },
      });
      text = response.text;
    } catch (error) {
      if (error instanceof ApiError && error.status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new HttpException('The AI service is busy. Please try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
      }
      if (error instanceof ApiError) throw new BadGatewayException('The AI service is unavailable right now. Please try again.');
      throw error;
    }
    const parsed = schema.safeParse(parseJson(text));
    if (!parsed.success) throw new BadGatewayException("The AI couldn't give a usable answer for that one.");
    return parsed.data;
  }
}

function parseJson(text: string | undefined): unknown {
  try {
    return JSON.parse(text ?? '');
  } catch {
    return undefined;
  }
}
