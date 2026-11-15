import { inArray } from 'drizzle-orm';
import type { Db } from '../db/create-db.ts';
import { pipelineRuns } from '../db/schema.ts';

export type DotStatus = 'passed' | 'running' | 'failed' | null;

// A running run with no report for this long has stopped reporting (Jenkins died, a step hung): it counts as failed.
export const STALE_MS = 30 * 60_000;

const RANK = { passed: 1, running: 2, failed: 3 } as const;

// The sidebar dot for each Pipelines space: from each job's newest run, failed beats running beats passed.
// Lives here rather than in the pipelines feature so SpacesService can use it without a module cycle.
// ponytail: reads every kept run of these spaces (at most 50 per job); a "latest run per job" query if spaces grow huge.
export async function dotStatuses(db: Db, spaceIds: string[], now = new Date()): Promise<Map<string, DotStatus>> {
  const result = new Map<string, DotStatus>(spaceIds.map((id) => [id, null]));
  if (spaceIds.length === 0) return result;
  const runs = await db
    .select({ spaceId: pipelineRuns.spaceId, job: pipelineRuns.job, number: pipelineRuns.number, status: pipelineRuns.status, updatedAt: pipelineRuns.updatedAt })
    .from(pipelineRuns)
    .where(inArray(pipelineRuns.spaceId, spaceIds));
  const newest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    const key = `${run.spaceId}\u0000${run.job}`;
    if ((newest.get(key)?.number ?? 0) < run.number) newest.set(key, run);
  }
  for (const run of newest.values()) {
    const stale = run.status === 'running' && now.getTime() - new Date(run.updatedAt).getTime() > STALE_MS;
    const status = stale ? 'failed' : (run.status as keyof typeof RANK);
    const current = result.get(run.spaceId) ?? null;
    if (!current || RANK[status] > RANK[current]) result.set(run.spaceId, status);
  }
  return result;
}
