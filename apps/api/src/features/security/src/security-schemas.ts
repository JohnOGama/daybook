import { z } from 'zod';

const title = z.string().trim().min(1).max(200);
const target = z.string().trim().max(2000).nullable();
const severity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const status = z.enum(['open', 'triaged', 'fixed', 'accepted']);
// CVSS base score in tenths: 0.0–10.0 stored as 0–100 so no float is kept.
const cvss = z.number().int().min(0).max(100).nullable();
const description = z.string().max(10000).nullable();
const owasp = z.enum(['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A10']).nullable();

export const findingSchema = z.object({
  id: z.uuid(),
  title,
  target: target.optional(),
  severity,
  status: status.optional(),
  cvss: cvss.optional(),
  description: description.optional(),
  owasp: owasp.optional(),
});

// `authorized` must be true: the person confirms they own or are allowed to test the target before any request is made.
export const scanSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  authorized: z.literal(true),
});

export const updateFindingSchema = z.object({
  title: title.optional(),
  target: target.optional(),
  severity: severity.optional(),
  status: status.optional(),
  cvss: cvss.optional(),
  description: description.optional(),
  owasp: owasp.optional(),
});
