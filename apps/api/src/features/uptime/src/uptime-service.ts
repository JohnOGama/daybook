import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, lte, max, or, sql } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, uptimeChecks, uptimeIncidents, uptimeMonitors } from '../../../shared/db/schema.ts';
import { type UptimeDot, uptimeDots } from '../../../shared/utils/uptime-status.ts';
import type { CheckResult } from './check-site.ts';
import type { Bar, Incident, MonitorDetail, MonitorRow, UptimeKind, UptimeStatus, UptimeView } from './uptime-types.ts';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const BUCKET_SECONDS = 30 * 60;
const BARS = 48;
const CHECK_EVERY_MS = MINUTE;
const KEEP_MS = 30 * DAY;
const MAX_SITES = 50;
const MAX_INCIDENTS = 50;
const BAR_OF_RANK: Bar[] = ['none', 'up', 'slow', 'down'];

type MonitorRecord = typeof uptimeMonitors.$inferSelect;
type Bucket = { monitorId: string; bucket: number; worst: number; avgMs: number | null; ups: number; total: number };

// Slow answers count as up: the site answered.
const upCount = sql<number>`(count(*) filter (where ${uptimeChecks.status} <> 'down'))::int`;
const owned = (ownerId: string, id: string) => and(eq(uptimeMonitors.id, id), eq(uptimeMonitors.userId, ownerId));
const iso = (date: Date | null) => (date ? date.toISOString() : null);
const percent = (ups: number, total: number) => (total === 0 ? null : Math.round((1000 * ups) / total) / 10);
const before = (now: Date, ms: number) => new Date(now.getTime() - ms);

@Injectable()
export class UptimeService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Stores one check and moves the site's status, opening an incident when it goes down and closing it when it's back.
  // Null when the site was deleted while it was being checked.
  async record(monitorId: string, result: CheckResult, at = new Date()): Promise<{ spaceId: string; changed: boolean } | null> {
    return this.db.transaction(async (tx) => {
      const [site] = await tx.select().from(uptimeMonitors).where(eq(uptimeMonitors.id, monitorId)).for('update');
      if (!site) return null;
      const isDown = result.status === 'down';
      const wasDown = site.status === 'down';
      await tx.insert(uptimeChecks).values({ monitorId, checkedAt: at, status: result.status, responseMs: result.responseMs, httpStatus: result.httpStatus, error: result.error });
      await tx
        .update(uptimeMonitors)
        .set({
          status: result.status,
          lastCheckedAt: at,
          lastResponseMs: result.responseMs,
          lastError: result.error,
          downSince: isDown ? (wasDown && site.downSince ? site.downSince : at) : null,
        })
        .where(eq(uptimeMonitors.id, monitorId));
      if (isDown && !wasDown) await tx.insert(uptimeIncidents).values({ monitorId, startedAt: at, reason: result.error });
      if (!isDown) {
        await tx.update(uptimeIncidents).set({ endedAt: at }).where(and(eq(uptimeIncidents.monitorId, monitorId), isNull(uptimeIncidents.endedAt)));
      }
      return { spaceId: site.spaceId, changed: site.status !== result.status };
    });
  }

  async load(ownerId: string, spaceId: string, now = new Date()): Promise<UptimeView> {
    const sites = await this.db
      .select()
      .from(uptimeMonitors)
      .where(and(eq(uptimeMonitors.spaceId, spaceId), eq(uptimeMonitors.userId, ownerId)))
      .orderBy(asc(uptimeMonitors.position), asc(uptimeMonitors.createdAt));
    const buckets = await this.buckets(sites.map(({ id }) => id), now);
    const [{ incidents7d }] = await this.db
      .select({ incidents7d: count() })
      .from(uptimeIncidents)
      .innerJoin(uptimeMonitors, eq(uptimeMonitors.id, uptimeIncidents.monitorId))
      .where(and(eq(uptimeMonitors.spaceId, spaceId), eq(uptimeMonitors.userId, ownerId), gt(uptimeIncidents.startedAt, before(now, 7 * DAY))));
    const newest = sites.reduce<Date | null>((latest, { lastCheckedAt }) => (lastCheckedAt && (!latest || lastCheckedAt > latest) ? lastCheckedAt : latest), null);
    return {
      monitors: sites.map((site) => toRow(site, buckets)),
      uptime24h: percent(sum(buckets, 'ups'), sum(buckets, 'total')),
      incidents7d,
      lastCheckedAt: iso(newest),
    };
  }

  async row(ownerId: string, id: string, now = new Date()): Promise<MonitorRow> {
    const site = await this.site(ownerId, id);
    return toRow(site, await this.buckets([id], now));
  }

  async monitor(ownerId: string, id: string, now = new Date()): Promise<MonitorDetail> {
    const site = await this.site(ownerId, id);
    const buckets = await this.buckets([id], now);
    const responseBars: (number | null)[] = new Array(BARS).fill(null);
    for (const { bucket, avgMs } of buckets) responseBars[BARS - 1 - bucket] = avgMs === null ? null : Math.round(avgMs);
    const incidents = await this.db
      .select()
      .from(uptimeIncidents)
      .where(and(eq(uptimeIncidents.monitorId, id), or(gt(uptimeIncidents.startedAt, before(now, KEEP_MS)), isNull(uptimeIncidents.endedAt))))
      .orderBy(desc(uptimeIncidents.startedAt))
      .limit(MAX_INCIDENTS);
    return {
      ...toRow(site, buckets),
      uptime7d: await this.uptimeSince(id, before(now, 7 * DAY)),
      uptime30d: await this.uptimeSince(id, before(now, KEEP_MS)),
      responseBars,
      incidents: incidents.map(({ id: incidentId, startedAt, endedAt, reason }): Incident => ({ id: incidentId, startedAt: startedAt.toISOString(), endedAt: iso(endedAt), reason })),
    };
  }

  async create(ownerId: string, spaceId: string, input: { id: string; name: string; url: string; kind: UptimeKind }): Promise<void> {
    const [{ sites, last }] = await this.db
      .select({ sites: count(), last: max(uptimeMonitors.position) })
      .from(uptimeMonitors)
      .where(eq(uptimeMonitors.spaceId, spaceId));
    if (sites >= MAX_SITES) throw new BadRequestException(`A space holds at most ${MAX_SITES} sites`);
    await this.db.insert(uptimeMonitors).values({ ...input, spaceId, userId: ownerId, position: (last ?? -1) + 1 });
  }

  // Pausing forgets the last result and closes an open incident: a paused site is neither up nor down, and the time it
  // spends paused never counts as downtime. Its next check after resuming starts afresh.
  async update(ownerId: string, id: string, changes: { name?: string; url?: string; kind?: UptimeKind; paused?: boolean }, now = new Date()): Promise<void> {
    if (Object.keys(changes).length === 0) return;
    await this.db.transaction(async (tx) => {
      const pausing = changes.paused === true ? { status: null, downSince: null, lastError: null } : {};
      const [site] = await tx.update(uptimeMonitors).set({ ...changes, ...pausing }).where(owned(ownerId, id)).returning({ id: uptimeMonitors.id });
      if (site && changes.paused === true) {
        await tx.update(uptimeIncidents).set({ endedAt: now }).where(and(eq(uptimeIncidents.monitorId, id), isNull(uptimeIncidents.endedAt)));
      }
    });
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.db.delete(uptimeMonitors).where(owned(ownerId, id));
  }

  // Sites to check now: unpaused, unchecked for a minute or more, in a space that isn't in Trash.
  // A folder or group above the space being in Trash is the scheduler's to check, through SpaceAccessService.
  async due(now = new Date()): Promise<{ id: string; url: string; spaceId: string }[]> {
    return this.db
      .select({ id: uptimeMonitors.id, url: uptimeMonitors.url, spaceId: uptimeMonitors.spaceId })
      .from(uptimeMonitors)
      .innerJoin(spaces, eq(spaces.id, uptimeMonitors.spaceId))
      .where(
        and(
          eq(uptimeMonitors.paused, false),
          isNull(spaces.deletedAt),
          or(isNull(uptimeMonitors.lastCheckedAt), lte(uptimeMonitors.lastCheckedAt, before(now, CHECK_EVERY_MS))),
        ),
      );
  }

  async prune(now = new Date()): Promise<void> {
    const cutoff = before(now, KEEP_MS);
    await this.db.delete(uptimeChecks).where(lt(uptimeChecks.checkedAt, cutoff));
    await this.db.delete(uptimeIncidents).where(lt(uptimeIncidents.endedAt, cutoff));
  }

  async dotStatus(spaceId: string): Promise<UptimeDot> {
    return (await uptimeDots(this.db, [spaceId])).get(spaceId) ?? null;
  }

  private async site(ownerId: string, id: string): Promise<MonitorRecord> {
    const [site] = await this.db.select().from(uptimeMonitors).where(owned(ownerId, id));
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }

  // The last 24 hours per site and half hour, counted in SQL so a load never pulls every check.
  private async buckets(monitorIds: string[], now: Date): Promise<Bucket[]> {
    if (monitorIds.length === 0) return [];
    const bucket = sql<number>`floor(extract(epoch from (${now.toISOString()}::timestamptz - ${uptimeChecks.checkedAt})) / ${BUCKET_SECONDS})::int`;
    const rows = await this.db
      .select({
        monitorId: uptimeChecks.monitorId,
        bucket,
        worst: sql<number>`max(case ${uptimeChecks.status} when 'down' then 3 when 'slow' then 2 else 1 end)::int`,
        avgMs: sql<number | null>`avg(${uptimeChecks.responseMs})::float8`,
        ups: upCount,
        total: sql<number>`count(*)::int`,
      })
      .from(uptimeChecks)
      .where(and(inArray(uptimeChecks.monitorId, monitorIds), gt(uptimeChecks.checkedAt, before(now, DAY)), lte(uptimeChecks.checkedAt, now)))
      .groupBy(uptimeChecks.monitorId, sql`2`);
    return rows.filter((row) => row.bucket >= 0 && row.bucket < BARS);
  }

  private async uptimeSince(monitorId: string, since: Date): Promise<number | null> {
    const [{ ups, total }] = await this.db
      .select({ ups: upCount, total: sql<number>`count(*)::int` })
      .from(uptimeChecks)
      .where(and(eq(uptimeChecks.monitorId, monitorId), gt(uptimeChecks.checkedAt, since)));
    return percent(ups, total);
  }
}

const sum = (buckets: Bucket[], key: 'ups' | 'total') => buckets.reduce((total, bucket) => total + bucket[key], 0);

function toRow(site: MonitorRecord, buckets: Bucket[]): MonitorRow {
  const own = buckets.filter(({ monitorId }) => monitorId === site.id);
  const bars: Bar[] = new Array(BARS).fill('none');
  for (const { bucket, worst } of own) bars[BARS - 1 - bucket] = BAR_OF_RANK[worst];
  return {
    id: site.id,
    name: site.name,
    url: site.url,
    kind: site.kind as UptimeKind,
    paused: site.paused,
    status: site.status as UptimeStatus | null,
    lastCheckedAt: iso(site.lastCheckedAt),
    lastResponseMs: site.lastResponseMs,
    lastError: site.lastError,
    downSince: iso(site.downSince),
    bars,
    uptime24h: percent(sum(own, 'ups'), sum(own, 'total')),
  };
}
