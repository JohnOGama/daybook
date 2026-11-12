import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
// Whole cents; the cap keeps sums well inside JavaScript's safe integer range.
const cents = z.number().int().max(1e13);
const positiveCents = cents.positive();
const day = z.iso.date();
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const icon = z.string().regex(/^[a-z0-9-]{1,40}$/).nullable().default(null);

export const ACCOUNT_TYPES = ['cash', 'bank', 'savings', 'ewallet', 'credit', 'loan'] as const;

export const spaceQuerySchema = z.object({ spaceId: z.uuid() });
export const updateBudgetSchema = z
  .object({
    currency: currencyCode,
    lowBalance: cents.min(-1e13),
    rates: z
      .record(currencyCode, z.number().positive().max(1e9))
      .refine((rates) => Object.keys(rates).length <= 50, 'Up to 50 rates'),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Nothing to change');

export const createAccountSchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  name,
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: cents.min(-1e13),
  // Yearly interest in basis points (1999 is 19.99%).
  aprBps: z.number().int().min(0).max(100_000).nullable().default(null),
  dueDay: z.number().int().min(-1).max(31).refine((value) => value !== 0).nullable().default(null),
  minimumPayment: positiveCents.nullable().default(null),
  currency: currencyCode.nullable().default(null),
  icon,
});
export const updateAccountSchema = createAccountSchema
  .pick({ name: true, type: true, openingBalance: true, aprBps: true, dueDay: true, minimumPayment: true, currency: true, icon: true })
  .partial();

export const createCategorySchema = z.object({
  id: z.uuid(),
  spaceId: z.uuid(),
  name,
  kind: z.enum(['income', 'expense']),
});
export const updateCategorySchema = z.object({ name: name.optional(), monthlyLimit: positiveCents.nullable().optional() });

// Money moving in, out, or between two accounts: the part entries and schedules share.
function flowSchema<T extends z.ZodRawShape>(extra: T) {
  const base = { amount: positiveCents, accountId: z.uuid(), ...extra };
  return z.discriminatedUnion('kind', [
    z.object({ kind: z.enum(['income', 'expense']), categoryId: z.uuid().nullable(), ...base }),
    z.object({ kind: z.literal('transfer'), toAccountId: z.uuid(), ...base }),
  ]);
}

export const entryShapeSchema = flowSchema({
  day,
  note: z.string().trim().max(500).default(''),
  // What arrived, when a transfer goes between accounts in different currencies.
  toAmount: positiveCents.nullable().default(null),
  icon,
});
export const createEntrySchema = z
  .intersection(
    z.object({ id: z.uuid(), spaceId: z.uuid(), scheduleId: z.uuid().optional(), occurrenceDay: day.optional() }),
    entryShapeSchema,
  )
  .refine((input) => (input.scheduleId === undefined) === (input.occurrenceDay === undefined), {
    message: 'A scheduled entry needs both its schedule and its day',
  });

export const scheduleShapeSchema = flowSchema({
  name,
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(365),
  // Days of the month for a monthly schedule; -1 is the last day.
  monthDays: z
    .array(z.number().int().min(-1).max(31).refine((value) => value !== 0))
    .max(32)
    .refine((values) => new Set(values).size === values.length, 'Each day can appear once'),
  startDay: day,
  endDay: day.nullable(),
  activeFrom: day,
  pausedFrom: day.nullable(),
  skippedDays: z.array(day).max(5000),
  autoRecord: z.boolean(),
  isSubscription: z.boolean(),
  icon,
}).refine((schedule) => schedule.endDay === null || schedule.endDay >= schedule.startDay, {
  message: 'The end date must be on or after the start date',
});
export const createScheduleSchema = z.intersection(z.object({ id: z.uuid(), spaceId: z.uuid() }), scheduleShapeSchema);

export type FlowShape = { amount: number; accountId: string } & (
  | { kind: 'income' | 'expense'; categoryId: string | null }
  | { kind: 'transfer'; toAccountId: string }
);
export type EntryShape = z.input<typeof entryShapeSchema>;
export type ScheduleShape = z.input<typeof scheduleShapeSchema>;

export const createGoalSchema = z.object({ id: z.uuid(), spaceId: z.uuid(), name, target: positiveCents, targetDay: day.nullable() });
export const updateGoalSchema = createGoalSchema.pick({ name: true, target: true, targetDay: true }).partial();
export const createContributionSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid(),
  amount: cents.min(-1e13).refine((value) => value !== 0, 'Enter an amount'),
  day,
  note: z.string().trim().max(200).default(''),
});

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
// About 6 MB of image once decoded.
const base64Image = z.string().min(1).max(8_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/);

export const receiptSchema = z.object({ mediaType: z.enum(IMAGE_TYPES), data: base64Image });
export const scanReceiptSchema = z.object({ spaceId: z.uuid(), today: day, mediaType: z.enum(IMAGE_TYPES), data: base64Image });
export const categorizeSchema = z.object({
  spaceId: z.uuid(),
  kind: z.enum(['income', 'expense']),
  note: z.string().trim().min(2).max(200),
  amount: z.string().max(40),
});
// The figures the browser has already worked out; kept small so nothing else rides along.
export const insightsSchema = z.object({ spaceId: z.uuid(), summary: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 8_000, 'Summary too long') });
