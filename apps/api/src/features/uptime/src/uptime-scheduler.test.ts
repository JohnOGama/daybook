import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces, uptimeMonitors } from '../../../shared/db/schema.ts';
import { createTestDb, insertFolder, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import type { CheckResult } from './check-site.ts';
import { UptimeScheduler } from './uptime-scheduler.ts';
import { UptimeService } from './uptime-service.ts';

const now = new Date('2026-11-21T12:00:00Z');
const later = (ms: number) => new Date(now.getTime() + ms);
const up: CheckResult = { status: 'up', responseMs: 120, httpStatus: 200, error: null };
const down: CheckResult = { status: 'down', responseMs: null, httpStatus: 502, error: '502 Bad Gateway' };

describe('UptimeScheduler', () => {
  let db: Db;
  let service: UptimeService;
  let spaceId: string;
  let scheduler: UptimeScheduler;
  const checker = { check: vi.fn<(url: string) => Promise<CheckResult>>(), isPublic: vi.fn(async () => true) };
  const notifier = { changed: vi.fn(async () => undefined) };

  async function addSite(name: string, inSpace = spaceId) {
    const id = randomUUID();
    await service.create('u1', inSpace, { id, name, url: `https://${name.toLowerCase()}.example`, kind: 'web' });
    return id;
  }

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    spaceId = await insertSpace(db, 'u1', { tool: 'uptime' });
    service = new UptimeService(db);
    checker.check.mockReset();
    notifier.changed.mockClear();
    scheduler = new UptimeScheduler(service, checker, notifier, new SpaceAccessService(db));
  });

  it('checks due sites, records them and pushes only when a dot changes', async () => {
    await addSite('A');
    checker.check.mockResolvedValue(down);
    await scheduler.tick(now);
    expect(checker.check).toHaveBeenCalledWith('https://a.example');
    expect(notifier.changed).toHaveBeenCalledWith(spaceId);
    const [site] = await db.select().from(uptimeMonitors);
    expect(site.status).toBe('down');
    expect((site.lastCheckedAt as Date).getTime() - now.getTime()).toBeGreaterThanOrEqual(0);
    expect((site.lastCheckedAt as Date).getTime() - now.getTime()).toBeLessThan(1000);

    await scheduler.tick(later(30_000));
    expect(checker.check).toHaveBeenCalledTimes(1);
    await scheduler.tick(later(61_000));
    expect(checker.check).toHaveBeenCalledTimes(2);
    expect(notifier.changed).toHaveBeenCalledTimes(1);
  });

  it('skips sites under a folder in Trash, and in paused sites', async () => {
    const folder = await insertFolder(db, 'u1');
    const inFolder = await insertSpace(db, 'u1', { tool: 'uptime', parentId: folder });
    await addSite('Hidden', inFolder);
    const paused = await addSite('Paused');
    await service.update('u1', paused, { paused: true });
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, folder));
    checker.check.mockResolvedValue(up);
    await scheduler.tick(now);
    expect(checker.check).not.toHaveBeenCalled();
  });

  it('runs at most five checks at once and never checks a site twice in parallel', async () => {
    for (let index = 0; index < 7; index++) await addSite(`S${index}`);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    checker.check.mockImplementation(async () => {
      await gate;
      return up;
    });
    const first = scheduler.tick(now);
    await vi.waitFor(() => expect(checker.check).toHaveBeenCalledTimes(5));
    await scheduler.tick(later(61_000));
    expect(checker.check).toHaveBeenCalledTimes(5);
    release();
    await first;
    expect(checker.check).toHaveBeenCalledTimes(7);
  });

  it('does not start a tick while the last one is still running', async () => {
    await addSite('A');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    checker.check.mockImplementation(async () => {
      await gate;
      return up;
    });
    const first = scheduler.tick(now);
    await vi.waitFor(() => expect(checker.check).toHaveBeenCalledTimes(1));
    await addSite('B');
    await scheduler.tick(later(61_000));
    expect(checker.check).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('records a queued site at the time its own check started, not the tick time', async () => {
    for (let index = 0; index < 6; index++) await addSite(`S${index}`);
    checker.check.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return up;
    });
    await scheduler.tick(now);
    const times = (await db.select().from(uptimeMonitors)).map(({ lastCheckedAt }) => (lastCheckedAt as Date).getTime() - now.getTime());
    expect(Math.max(...times)).toBeGreaterThanOrEqual(50);
    expect(Math.min(...times)).toBeLessThan(50);
  });

  it('prunes once an hour', async () => {
    const prune = vi.spyOn(service, 'prune');
    await scheduler.tick(now);
    await scheduler.tick(later(30 * 60_000));
    expect(prune).toHaveBeenCalledTimes(1);
    await scheduler.tick(later(61 * 60_000));
    expect(prune).toHaveBeenCalledTimes(2);
  });

  it('keeps going when one check throws', async () => {
    await addSite('A');
    await addSite('B');
    checker.check.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(up);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await scheduler.tick(now);
    const statuses = (await db.select().from(uptimeMonitors)).map(({ status }) => status).sort();
    expect(statuses).toEqual([null, 'up']);
  });

  it('does not start its timer under tests', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    scheduler.onModuleInit();
    expect(setInterval).not.toHaveBeenCalled();
    scheduler.onApplicationShutdown();
  });
});
