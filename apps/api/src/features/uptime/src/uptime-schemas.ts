import { z } from 'zod';

const name = z.string().trim().min(1).max(100);
const url = z.string().trim().min(1).max(2000);
const kind = z.enum(['web', 'api']);

export const monitorSchema = z.object({ id: z.uuid(), name, url, kind });
export const updateMonitorSchema = z.object({ name: name.optional(), url: url.optional(), kind: kind.optional(), paused: z.boolean().optional() });
