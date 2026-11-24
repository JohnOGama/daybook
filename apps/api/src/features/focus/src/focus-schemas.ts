import { z } from 'zod';

const day = z.iso.date();
const MAX_RANGE_DAYS = 400;

export const DEFAULT_SETTINGS = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

export const settingsSchema = z.object({
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(90),
  longBreakEvery: z.number().int().min(1).max(12),
});
export type FocusSettings = z.infer<typeof settingsSchema>;

export const sessionSchema = z.object({
  id: z.uuid(),
  day,
  startedAt: z.iso.datetime({ offset: true }),
  minutes: z.number().int().min(1).max(180),
  taskId: z.uuid().nullable().default(null),
  taskTitle: z.string().trim().min(1).max(500).nullable().default(null),
});
export type SessionInput = z.infer<typeof sessionSchema>;

const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

export const rangeSchema = z
  .object({ from: day, to: day })
  .refine(({ from, to }) => from <= to && daysBetween(from, to) <= MAX_RANGE_DAYS, 'Ask for at most 400 days, oldest first');
