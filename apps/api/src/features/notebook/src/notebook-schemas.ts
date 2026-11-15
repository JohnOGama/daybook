import { z } from 'zod';

const title = z.string().trim().max(200);
const content = z.looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() });
const version = z.number().int().min(0);

export const listPagesSchema = z.object({ spaceId: z.uuid() });
export const createPageSchema = z.object({ id: z.uuid(), spaceId: z.uuid() });
// Content needs the version it was edited from, so a stale save can be refused; a rename alone never conflicts.
export const updatePageSchema = z
  .object({ title: title.optional(), content: content.optional(), version: version.optional() })
  .refine((page) => page.content === undefined || page.version !== undefined, { message: 'Send the version you edited', path: ['version'] });
export const improveTextSchema = z.object({ spaceId: z.uuid(), text: z.string().trim().min(1).max(8000), instruction: z.string().trim().min(1).max(300) });
export const reorderPagesSchema = z.object({ spaceId: z.uuid(), ids: z.array(z.uuid()).min(1).max(1000) });
