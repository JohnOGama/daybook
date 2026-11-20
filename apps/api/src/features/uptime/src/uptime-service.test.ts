import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { uptimeChecks, uptimeIncidents, uptimeMonitors } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import type { CheckResult } from './check-site.ts';
import { UptimeService } from './uptime-service.ts';

const now = new Date('2026-11-21T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const up: CheckResult = { status: 'up', responseMs: 120, httpStatus: 200, error: null };
const slow: CheckResult = { status: 'slow', responseMs: 2400, httpStatus: 200, error: null };
const down: CheckResult = { status: 'down', responseMs: null, httpStatus: 502, error: '502 Bad Gateway' };

describe('UptimeService', () => {
  let db: Db;
  let service: UptimeService;
  let spaceId: string;

  async function addSite(name = 'Site', url = `https://${name.toLowerCase()}.example`) {
    const id = randomUUID();
    await service.create('u1', spaceId, { id, name, url, kind: 'web' });
    return id;
  }

  const insertCheck = (monitorId: string, checkedAt: Date, result: CheckResult) =>
    db.insert(uptimeChecks).values({ monitorId, checkedAt, status: result.status, responseMs: result.responseMs, httpStatus: result.httpStatus, error: result.error });

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    spaceId = await insertSpace(db, 'u1', { tool: 'uptime' });
    service = new UptimeService(db);
  });

  it('records a check and reports a change only when the status moves', async () => {
    const id = await addSite();
    expect(await service.record(id, up, now)).toEqual({ spaceId, changed: true });
    expect(await service.record(id, up, new Date(+now + MIN))).toEqual({ spaceId, changed: false });
    expect(await service.record(id, slow, new Date(+now + 2 * MIN))).toEqual({ spaceId, changed: true });
    const [site] = await db.select().from(uptimeMonitors);
    expect(site).toMatchObject({ status: 'slow', lastResponseMs: 2400, lastError: null, lastCheckedAt: new Date(+now + 2 * MIN) });
    expect(await db.select().from(uptimeChecks)).toHaveLength(3);
  });

  it('keeps one open incident while down and closes it when back', async () => {
    const id = await addSite();
    await service.record(id, up, ago(MIN));
    await service.record(id, down, now);
    await service.record(id, down, new Date(+now + MIN));
    await service.record(id, up, new Date(+now + 2 * MIN));
    const incidents = await db.select().from(uptimeIncidents);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({ monitorId: id, reason: '502 Bad Gateway', startedAt: now, endedAt: new Date(+now + 2 * MIN) });
  });

  it('keeps downSince from the first down check and clears it when back', async () => {
    const id = await addSite();
    await service.record(id, down, now);
    await service.record(id, down, new Date(+now + MIN));
    expect((await db.select().from(uptimeMonitors))[0]).toMatchObject({ status: 'down', downSince: now, lastError: '502 Bad Gateway', lastResponseMs: null });
    await service.record(id, up, new Date(+now + 2 * MIN));
    expect((await db.select().from(uptimeMonitors))[0].downSince).toBeNull();
  });

  it('returns null for a site deleted mid-check', async () => {
    const id = await addSite();
    await service.remove('u1', id);
    expect(await service.record(id, up, now)).toBeNull();
  });

  it('buckets the last 24 hours into 48 bars, worst result first, and leaves exactly-24h-old checks out', async () => {
    const id = await addSite();
    await insertCheck(id, ago(DAY), down);
    await insertCheck(id, ago(DAY - MIN), down);
    await insertCheck(id, ago(10 * MIN), slow);
    await insertCheck(id, ago(5 * MIN), up);
    const { monitors } = await service.load('u1', spaceId, now);
    expect(monitors[0].bars).toHaveLength(48);
    expect(monitors[0].bars[0]).toBe('down');
    expect(monitors[0].bars[47]).toBe('slow');
    expect(monitors[0].bars.slice(1, 47).every((bar) => bar === 'none')).toBe(true);
    expect(monitors[0].uptime24h).toBe(66.7);
  });

  it('sums the space: 24 h uptime across sites, incidents in 7 days, newest check', async () => {
    const a = await addSite('A');
    const b = await addSite('B');
    await insertCheck(a, ago(MIN), up);
    await insertCheck(b, ago(MIN), up);
    await insertCheck(b, ago(2 * MIN), up);
    await insertCheck(b, ago(3 * MIN), down);
    await db.insert(uptimeIncidents).values([
      { monitorId: a, startedAt: ago(2 * DAY), endedAt: ago(2 * DAY - 10 * MIN), reason: 'Timed out after 10 s' },
      { monitorId: b, startedAt: ago(3 * MIN), endedAt: ago(2 * MIN), reason: '502 Bad Gateway' },
      { monitorId: b, startedAt: ago(8 * DAY), endedAt: ago(8 * DAY - MIN), reason: 'old' },
    ]);
    await db.update(uptimeMonitors).set({ lastCheckedAt: ago(MIN) }).where(eq(uptimeMonitors.id, b));
    const view = await service.load('u1', spaceId, now);
    expect(view.monitors.map(({ name }) => name)).toEqual(['A', 'B']);
    expect(view.uptime24h).toBe(75);
    expect(view.incidents7d).toBe(2);
    expect(view.lastCheckedAt).toBe(ago(MIN).toISOString());
    expect(view.monitors[0].uptime24h).toBe(100);
  });

  it('gives a site’s detail: 7 and 30 day uptime, response averages per bar, incidents newest first', async () => {
    const id = await addSite();
    await insertCheck(id, ago(5 * MIN), { ...up, responseMs: 100 });
    await insertCheck(id, ago(6 * MIN), { ...up, responseMs: 300 });
    await insertCheck(id, ago(3 * DAY), down);
    await insertCheck(id, ago(20 * DAY), down);
    await insertCheck(id, ago(40 * DAY), down);
    await db.insert(uptimeIncidents).values([
      { monitorId: id, startedAt: ago(20 * DAY), endedAt: ago(20 * DAY - 25 * MIN), reason: 'Timed out after 10 s' },
      { monitorId: id, startedAt: ago(3 * DAY), endedAt: ago(3 * DAY - 4 * MIN), reason: 'Connection refused' },
      { monitorId: id, startedAt: ago(40 * DAY), endedAt: ago(40 * DAY - MIN), reason: 'too old' },
    ]);
    const detail = await service.monitor('u1', id, now);
    expect(detail.uptime24h).toBe(100);
    expect(detail.uptime7d).toBe(66.7);
    expect(detail.uptime30d).toBe(50);
    expect(detail.responseBars).toHaveLength(48);
    expect(detail.responseBars[47]).toBe(200);
    expect(detail.responseBars[0]).toBeNull();
    expect(detail.incidents.map(({ reason }) => reason)).toEqual(['Connection refused', 'Timed out after 10 s']);
    expect(detail.incidents[0]).toEqual({ id: expect.any(String), startedAt: ago(3 * DAY).toISOString(), endedAt: ago(3 * DAY - 4 * MIN).toISOString(), reason: 'Connection refused' });
  });

  it('lists an ongoing incident in the detail however old it is', async () => {
    const id = await addSite();
    await db.insert(uptimeIncidents).values({ monitorId: id, startedAt: ago(45 * DAY), endedAt: null, reason: 'Connection refused' });
    expect((await service.monitor('u1', id, now)).incidents).toHaveLength(1);
  });

  it('lists due sites: never checked or checked a minute ago or more, not paused, not in Trash', async () => {
    const a = await addSite('A');
    const b = await addSite('B');
    const c = await addSite('C');
    const d = await addSite('D');
    await db.update(uptimeMonitors).set({ lastCheckedAt: ago(61_000) }).where(eq(uptimeMonitors.id, b));
    await db.update(uptimeMonitors).set({ lastCheckedAt: ago(30_000) }).where(eq(uptimeMonitors.id, c));
    await service.update('u1', d, { paused: true });
    const trashed = await insertSpace(db, 'u1', { tool: 'uptime', deletedAt: new Date() });
    await db.insert(uptimeMonitors).values({ spaceId: trashed, userId: 'u1', name: 'E', url: 'https://e.example', kind: 'web' });
    expect(await service.due(now)).toEqual(
      expect.arrayContaining([
        { id: a, url: 'https://a.example', spaceId },
        { id: b, url: 'https://b.example', spaceId },
      ]),
    );
    expect(await service.due(now)).toHaveLength(2);
  });

  it('prunes checks and closed incidents older than 30 days, keeping an ongoing one', async () => {
    const id = await addSite();
    await insertCheck(id, ago(31 * DAY), up);
    await insertCheck(id, ago(29 * DAY), up);
    await db.insert(uptimeIncidents).values([
      { monitorId: id, startedAt: ago(32 * DAY), endedAt: ago(31 * DAY), reason: 'old' },
      { monitorId: id, startedAt: ago(40 * DAY), endedAt: null, reason: 'ongoing' },
      { monitorId: id, startedAt: ago(2 * DAY), endedAt: ago(2 * DAY - MIN), reason: 'recent' },
    ]);
    await service.prune(now);
    expect(await db.select().from(uptimeChecks)).toHaveLength(1);
    expect((await db.select().from(uptimeIncidents)).map(({ reason }) => reason).sort()).toEqual(['ongoing', 'recent']);
  });

  it('gives the dot: down beats slow beats up, ignoring paused and never-checked sites', async () => {
    expect(await service.dotStatus(spaceId)).toBeNull();
    const a = await addSite('A');
    const b = await addSite('B');
    const c = await addSite('C');
    await addSite('Never');
    await service.record(a, up, now);
    expect(await service.dotStatus(spaceId)).toBe('up');
    await service.record(b, slow, now);
    expect(await service.dotStatus(spaceId)).toBe('slow');
    await service.record(c, down, now);
    expect(await service.dotStatus(spaceId)).toBe('down');
    await service.update('u1', c, { paused: true });
    expect(await service.dotStatus(spaceId)).toBe('slow');
  });

  it('only reads or changes sites of the owner it is given', async () => {
    const id = await addSite('Mine');
    await expect(service.row('u2', id, now)).rejects.toThrow('Site not found');
    await expect(service.monitor('u2', id, now)).rejects.toThrow('Site not found');
    expect((await service.load('u2', spaceId, now)).monitors).toEqual([]);
    await service.update('u2', id, { name: 'Hacked' });
    await service.remove('u2', id);
    expect(await db.select().from(uptimeMonitors)).toMatchObject([{ id, name: 'Mine' }]);
  });

  it('pausing a down site closes its incident and forgets the down status', async () => {
    const id = await addSite();
    await service.record(id, down, ago(10 * MIN));
    await service.update('u1', id, { paused: true }, now);
    expect((await db.select().from(uptimeMonitors))[0]).toMatchObject({ paused: true, status: null, downSince: null, lastError: null });
    expect((await db.select().from(uptimeIncidents))[0].endedAt).toEqual(now);
  });

  it('refuses a 51st site', async () => {
    for (let index = 0; index < 50; index++) await addSite(`S${index}`);
    await expect(addSite('One too many')).rejects.toThrow('A space holds at most 50 sites');
  });

  it('gives one site in the list shape', async () => {
    const id = await addSite('Gym API');
    await service.record(id, down, ago(MIN));
    expect(await service.row('u1', id, now)).toMatchObject({ id, name: 'Gym API', kind: 'web', paused: false, status: 'down', lastError: '502 Bad Gateway', downSince: ago(MIN).toISOString(), uptime24h: 0 });
  });
});
