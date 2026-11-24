import { z } from 'zod';

const day = z.iso.date();
const optionalText = (max: number) => z.string().trim().max(max).nullable();
const link = z
  .url({ protocol: /^https?$/ })
  .max(2000);

export const spaceQuerySchema = z.object({ spaceId: z.uuid() });

export const jobStatusSchema = z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected']);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('status'), status: jobStatusSchema, day }),
  z.object({ kind: z.literal('followUp'), day }),
]);
export type JobEvent = z.infer<typeof jobEventSchema>;

const skills = z.array(z.string().trim().min(1).max(40)).max(12);

export const matchSchema = z.object({
  pct: z.number().int().min(0).max(100),
  summary: z.string().max(300),
  skillsHave: skills,
  skillsMissing: skills,
  matchedAt: z.iso.datetime({ offset: true }),
});
export type Match = z.infer<typeof matchSchema>;

const jobFields = {
  role: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  url: link.nullable(),
  location: optionalText(120),
  workMode: z.enum(['remote', 'hybrid', 'onsite']).nullable(),
  salary: optionalText(80),
  employmentType: optionalText(40),
  postedOn: day.nullable(),
  description: z.string().max(30_000).default(''),
  notes: z.string().max(5_000).default(''),
  status: jobStatusSchema,
  events: z.array(jobEventSchema).max(200),
  nextStepDay: day.nullable(),
  nextStepNote: optionalText(120),
  nextStepAt: z.iso.datetime({ offset: true }).nullable().default(null),
};

export const jobFieldsSchema = z.object(jobFields);
export type JobFields = z.infer<typeof jobFieldsSchema>;

// `createdAt` and `match` let Undo put a deleted job back exactly as it was.
export const newJobSchema = jobFieldsSchema.extend({
  id: z.uuid(),
  spaceId: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  match: matchSchema.nullable().optional(),
});
export type NewJob = z.infer<typeof newJobSchema>;

// A change carries only what changed: a field's default (an empty description, no next step) must not fill in a field
// that wasn't sent, or every status change would wipe the description and notes.
const withoutDefault = (schema: z.ZodType): z.ZodType => (schema instanceof z.ZodDefault ? (schema.removeDefault() as z.ZodType) : schema);
const partialFields = Object.fromEntries(Object.entries(jobFields).map(([key, schema]) => [key, withoutDefault(schema).optional()])) as {
  [K in keyof typeof jobFields]: z.ZodOptional<(typeof jobFields)[K]>;
};

export const updateJobSchema = z
  .object(partialFields)
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), 'Nothing to change');
export type JobChanges = z.infer<typeof updateJobSchema>;

export const saveCvSchema = z.object({ spaceId: z.uuid(), cvText: z.string().trim().max(20_000).nullable() });

export const readPostingSchema = z.object({ spaceId: z.uuid(), url: link });
