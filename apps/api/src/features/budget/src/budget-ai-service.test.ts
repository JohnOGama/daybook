import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BudgetAiService } from './budget-ai-service.ts';

const categories = [
  { id: 'food', name: 'Food' },
  { id: 'transport', name: 'Transport' },
];

// Stands in for Gemini: replies with the given text.
function withReply(text: string) {
  const service = new BudgetAiService();
  const generateContent = vi.fn(async (_request: unknown) => ({ text }));
  Object.assign(service, { client: { models: { generateContent } } });
  return { service, generateContent };
}

describe('BudgetAiService', () => {
  it('is off without a Gemini key and says how to turn it on', async () => {
    const service = new BudgetAiService();
    expect(service.enabled).toBe(process.env.GEMINI_API_KEY !== undefined && process.env.GEMINI_API_KEY !== '');
    Object.assign(service, { client: null });
    await expect(service.categorize(categories, { note: 'Bus', kind: 'expense', amount: '$2' })).rejects.toThrow(ServiceUnavailableException);
  });

  it('maps the chosen category name back to its id, and NONE to no category', async () => {
    expect(await withReply('{"category":"Transport"}').service.categorize(categories, { note: 'Bus', kind: 'expense', amount: '$2' })).toBe('transport');
    expect(await withReply('{"category":"NONE"}').service.categorize(categories, { note: 'Gift', kind: 'expense', amount: '$2' })).toBeNull();
  });

  it('refuses a reply that does not fit the schema instead of using it', async () => {
    const { service } = withReply('{"category":"Rent"}');
    await expect(service.categorize(categories, { note: 'Flat', kind: 'expense', amount: '$900' })).rejects.toThrow(BadGatewayException);
    await expect(withReply('not json').service.insights({ month: '2026-11' })).rejects.toThrow(BadGatewayException);
  });

  it('reads a receipt into cents and drops dates in the future or numbers it could not read', async () => {
    const { service, generateContent } = withReply('{"merchant":" Corner Cafe ","total":12.5,"currency":"EUR","date":"2026-11-10","category":"Food"}');
    expect(await service.scanReceipt(categories, { data: 'aGk=', mediaType: 'image/jpeg' }, '2026-11-12')).toEqual({
      merchant: 'Corner Cafe',
      amount: 1_250,
      currency: 'EUR',
      day: '2026-11-10',
      categoryId: 'food',
    });
    expect(generateContent.mock.calls[0][0]).toMatchObject({ config: { responseMimeType: 'application/json' } });
    const unsure = withReply('{"merchant":null,"total":null,"currency":"euros","date":"2027-01-01","category":"NONE"}');
    expect(await unsure.service.scanReceipt(categories, { data: 'aGk=', mediaType: 'image/png' }, '2026-11-12')).toEqual({
      merchant: null,
      amount: null,
      currency: null,
      day: null,
      categoryId: null,
    });
  });
});
