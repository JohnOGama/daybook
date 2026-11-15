import { z } from 'zod';

const spaceId = z.uuid();
export const MAX_DBML = 100_000;

export const spaceQuerySchema = z.object({ spaceId });

export const positionsSchema = z
  .record(z.string().min(1).max(200), z.object({ x: z.number().finite(), y: z.number().finite() }))
  .refine((positions) => Object.keys(positions).length <= 500, 'Too many tables');
export type Positions = z.infer<typeof positionsSchema>;

export const saveDiagramSchema = z.object({ spaceId, dbml: z.string().max(MAX_DBML), positions: positionsSchema, version: z.number().int().min(0) });

export const aiEditSchema = z.object({ spaceId, dbml: z.string().max(MAX_DBML), prompt: z.string().trim().min(1).max(1_000) });
