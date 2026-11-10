import { z } from 'zod';

const title = z.string().trim().min(1).max(200);
const id = z.uuid().optional();

export const createSpaceSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('folder'), title, parentId: z.never().optional() }),
  z.object({
    id,
    kind: z.literal('space'),
    title,
    tool: z.enum(['list', 'notebook', 'vault']),
    parentId: z.uuid().optional(),
  }),
]);

export const listSpacesSchema = z.object({ today: z.iso.date() });
export const renameSpaceSchema = z.object({ title });
export const duplicateSpaceSchema = z.object({ id });
export const carryOverSchema = z.object({ carryOver: z.boolean() });
export const reorderSpacesSchema =z.object({ ids: z.array(z.uuid()).min(1).max(1000) });

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
