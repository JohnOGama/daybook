import { z } from 'zod';

const title = z.string().trim().min(1).max(200);
const id = z.uuid().optional();

export const createSpaceSchema = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('folder'), title, parentId: z.never().optional(), groupId: z.uuid().optional() }),
  z.object({
    id,
    kind: z.literal('space'),
    title,
    tool: z.enum(['list', 'notebook', 'vault', 'book', 'budget', 'fitness', 'jobs', 'diagram', 'pipelines']),
    parentId: z.uuid().optional(),
    groupId: z.uuid().optional(),
  }),
]);

export const createGroupSchema = z.object({ id, title });
export const moveToGroupSchema = z.object({ groupId: z.uuid(), order: z.array(z.uuid()).min(1).max(1000).optional() });

export const listSpacesSchema = z.object({ today: z.iso.date() });
export const renameSpaceSchema = z.object({ title });
export const duplicateSpaceSchema = z.object({ id });
export const moveSpaceSchema = z.object({ parentId: z.uuid().nullable() });
export const carryOverSchema = z.object({ carryOver: z.boolean() });
export const reorderSpacesSchema =z.object({ ids: z.array(z.uuid()).min(1).max(1000) });

const lockPassword = z.string().min(4, 'Use at least 4 characters').max(200);
export const unlockSchema = z.object({ password: z.string().max(200) });
export const setLockSchema = z.object({ password: lockPassword, currentPassword: z.string().max(200).optional() });
export const removeLockSchema = z.union([
  z.object({ password: z.string().max(200) }),
  z.object({ accountPassword: z.string().max(200) }),
]);

const shareRole = z.enum(['edit', 'view']);
export const shareSchema = z.object({ id: z.uuid(), email: z.string().trim().toLowerCase().pipe(z.email()), role: shareRole });
export const shareRoleSchema = z.object({ role: shareRole });

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type ShareInput = z.infer<typeof shareSchema>;
