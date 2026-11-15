import { desc, inArray } from 'drizzle-orm';
import type { Db } from '../db/create-db.ts';
import { pipelineRuns } from '../db/schema.ts';

export type DotStatus = 'passed' | 'running' | 'failed' | null;

// A running run with no report for this long has stopped reporting (Jenkins died, a step hung): it counts as failed.
export const STALE_MS = 30 * 60_000;

const RANK = { passed: 1, running: 2, failed: 3 } as const;

// The sidebar dot for each Pipelines space: from each job's newest run, failed beats running beats passed.
// Lives here rather than in the pipelines feature so SpacesService can use it without a module cycle.
// Reads only each job's newest run (DISTINCT ON), since this runs on every GET /spaces.
export async function dotStatuses(db: Db, spaceIds: string[], now = new Date()): Promise<Map<string, DotStatus>> {
  const result = new Map<string, DotStatus>(spaceIds.map((id) => [id, null]));
  if (spaceIds.length === 0) return result;
  const newest = await db
    .selectDistinctOn([pipelineRuns.spaceId, pipelineRuns.job], { spaceId: pipelineRuns.spaceId, status: pipelineRuns.status, updatedAt: pipelineRuns.updatedAt })
    .from(pipelineRuns)
    .where(inArray(pipelineRuns.spaceId, spaceIds))
    .orderBy(pipelineRuns.spaceId, pipelineRuns.job, desc(pipelineRuns.number));
  for (const run of newest) {
    const stale = run.status === 'running' && now.getTime() - new Date(run.updatedAt).getTime() > STALE_MS;
    const status = stale ? 'failed' : (run.status as keyof typeof RANK);
    const current = result.get(run.spaceId) ?? null;
    if (!current || RANK[status] > RANK[current]) result.set(run.spaceId, status);
  }
  return result;
}
