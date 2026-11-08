import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const day = z.iso.date();
const title = z.string().trim().min(1).max(200);
const status = z.enum(['todo', 'in_progress', 'on_hold']);

export const rangeSchema = z.object({ from: day, to: day, today: day });
export const createTaskSchema = z.object({
  title,
  day,
  status: status.optional(),
  highPriority: z.boolean().optional(),
});
export const createSubtaskSchema = z.object({
  title,
  status: status.optional(),
  highPriority: z.boolean().optional(),
});
export const updateTaskSchema = z.object({
  title: title.optional(),
  status: status.optional(),
  highPriority: z.boolean().optional(),
  day: day.optional(),
});
export const finishedSchema = z.object({ finished: z.boolean(), today: day });
export const todaySchema = z.object({ today: day });

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}
