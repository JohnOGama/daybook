import { z } from 'zod';

const MAX_ERROR = 8_000;
const MAX_MESSAGE = 500;

const httpUrl = z
  .string()
  .max(2_000)
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'Must be an http(s) link');

// Jenkins sends BUILD_NUMBER as a string; a number works too.
const runNumber = z.union([z.number(), z.string().regex(/^\d+$/, 'Must be a whole number').transform(Number)]).pipe(z.number().int().positive().max(2_147_483_647));

// Jenkins sends null for values it doesn't have (BUILD_URL before a Jenkins URL is set): null means "not given".
const dropNulls = (value: unknown) =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, field]) => field !== null)) : value;

// One report from a pipeline: a stage starting or finishing, or (without `stage`) the whole run finishing.
// A long message or error is cut rather than refused, so a report is never lost over its length.
const reportShape = z
  .object({
    job: z.string().trim().min(1).max(200),
    run: runNumber,
    stage: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['started', 'passed', 'failed', 'skipped', 'aborted']),
    message: z
      .string()
      .transform((value) => value.trim().slice(0, MAX_MESSAGE))
      .optional(),
    error: z
      .string()
      .transform((value) => value.slice(-MAX_ERROR))
      .optional(),
    url: httpUrl.optional(),
    branch: z.string().max(200).optional(),
    commit: z.string().max(64).optional(),
  })
  .superRefine((report, ctx) => {
    if (report.stage && report.status === 'aborted') ctx.addIssue({ code: 'custom', path: ['status'], message: 'A stage is started, passed, failed or skipped' });
    if (!report.stage && (report.status === 'started' || report.status === 'skipped')) {
      ctx.addIssue({ code: 'custom', path: ['status'], message: 'Without a stage, a run finishes as passed, failed or aborted' });
    }
  });
export const reportSchema = z.preprocess(dropNulls, reportShape);
export type Report = z.infer<typeof reportShape>;

export const spaceQuerySchema = z.object({ spaceId: z.uuid() });

export const instrumentSchema = z.object({ spaceId: z.uuid(), jenkinsfile: z.string().min(1).max(100_000) });
