import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/create-db.ts';
import { uptimeMonitors } from '../db/schema.ts';

export type UptimeDot = 'up' | 'slow' | 'down' | null;

const RANK = { up: 1, slow: 2, down: 3 } as const;

// The sidebar dot for each Uptime space, from its sites' current status: down beats slow beats up.
// Paused and never-checked sites don't count. Lives here, like pipeline-status, so SpacesService can use it without a module cycle.
export async function uptimeDots(db: Db, spaceIds: string[]): Promise<Map<string, UptimeDot>> {
  const result = new Map<string, UptimeDot>(spaceIds.map((id) => [id, null]));
  if (spaceIds.length === 0) return result;
  const sites = await db
    .select({ spaceId: uptimeMonitors.spaceId, status: uptimeMonitors.status })
    .from(uptimeMonitors)
    .where(and(inArray(uptimeMonitors.spaceId, spaceIds), eq(uptimeMonitors.paused, false), isNotNull(uptimeMonitors.status)));
  for (const { spaceId, status } of sites) {
    const rank = RANK[status as keyof typeof RANK];
    const current = result.get(spaceId) ?? null;
    if (rank && (!current || rank > RANK[current])) result.set(spaceId, status as keyof typeof RANK);
  }
  return result;
}
