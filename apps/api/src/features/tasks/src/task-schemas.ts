import { z } from 'zod';

const day = z.iso.date();
const title = z.string().trim().min(1).max(200);
const status = z.enum(['todo', 'in_progress', 'on_hold']);

export const rangeSchema = z.object({ spaceId: z.uuid(), from: day, to: day, today: day });
export const createTaskSchema = z.object({
  id: z.uuid().optional(),
  spaceId: z.uuid(),
  title,
  day,
  status: status.optional(),
  highPriority: z.boolean().optional(),
});
const pastedTask = z.object({
  id: z.uuid(),
  title,
  get subtasks() {
    return z.array(pastedTask).max(500);
  },
});

export const createManySchema = z.object({
  spaceId: z.uuid(),
  day,
  tasks: z.array(pastedTask).min(1).max(500),
});
export const createSubtaskSchema =z.object({
  id: z.uuid().optional(),
  title,
  status: status.optional(),
  highPriority: z.boolean().optional(),
});
export const createManySubtasksSchema = z.object({
  subtasks: z.array(pastedTask).min(1).max(500),
});
export const updateTaskSchema =z.object({
  title: title.optional(),
  status: status.optional(),
  highPriority: z.boolean().optional(),
  day: day.optional(),
});
export const finishedSchema = z.object({ finished: z.boolean(), today: day, status: status.optional() });
export const todaySchema = z.object({ today: day });
export const copySchema = z.object({
  today: day,
  spaceId: z.uuid().optional(),
  newIds: z.record(z.uuid(), z.uuid()).optional(),
});
export const reorderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(1000) });
export const removeManySchema = reorderSchema;
