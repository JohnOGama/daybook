import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, uptimeChecks, uptimeIncidents, uptimeMonitors } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import type { CheckResult } from './check-site.ts';
import { UptimeController } from './uptime-controller.ts';
import { UPTIME_NOTIFIER } from './uptime-notifier.ts';
import { UPTIME_CHECKER } from './uptime-scheduler.ts';
import { UptimeService } from './uptime-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

const up: CheckResult = { status: 'up', responseMs: 120, httpStatus: 200, error: null };
const down: CheckResult = { status: 'down', responseMs: null, httpStatus: 502, error: '502 Bad Gateway' };

type Method = 'get' | 'post' | 'patch' | 'delete';

describe('uptime API', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;
  let siteId: string;
  const newId = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c20';
  const checker = { check: vi.fn(async (): Promise<CheckResult> => up), isPublic: vi.fn(async () => true) };
  const notifier = { changed: vi.fn(async () => undefined) };
  const as = (user: string, method: Method, path: string) => request(app.getHttpServer())[method](`/api/uptime${path}`).set('x-test-user', user);
  const fill = (path: string) => path.replaceAll('SPACE', spaceId).replaceAll('SITE', siteId);
  const counts = async () => [
    (await db.select().from(uptimeMonitors)).length,
    (await db.select().from(uptimeChecks)).length,
    (await db.select().from(uptimeIncidents)).length,
  ];

  beforeEach(async () => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
    db = await createTestDb();
    for (const id of ['u1', 'u2', 'u3']) await insertUser(db, id);
    spaceId = await insertSpace(db, 'u1', { tool: 'uptime' });
    const [site] = await db.insert(uptimeMonitors).values({ spaceId, userId: 'u1', name: 'Gym API', url: 'https://api.gym.example/api/health', kind: 'api' }).returning();
    siteId = site.id;
    checker.check.mockReset().mockResolvedValue(up);
    checker.isPublic.mockReset().mockResolvedValue(true);
    notifier.changed.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [UptimeController],
      providers: [
        UptimeService,
        SpaceAccessService,
        SpaceLockService,
        AuthGuard,
        { provide: DB, useValue: db },
        { provide: AUTH, useValue: fakeAuth },
        { provide: UPTIME_CHECKER, useValue: checker },
        { provide: UPTIME_NOTIFIER, useValue: notifier },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('adds a site, checks it at once and returns it green', async () => {
    const { body } = await as('u1', 'post', `/${spaceId}/monitors`).send({ id: newId, name: ' Daybook web ', url: 'https://daybook.example', kind: 'web' }).expect(201);
    expect(body).toMatchObject({ id: newId, name: 'Daybook web', kind: 'web', status: 'up', lastResponseMs: 120 });
    expect(body.bars[47]).toBe('up');
    expect(checker.check).toHaveBeenCalledWith('https://daybook.example');
    expect(notifier.changed).toHaveBeenCalledWith(spaceId);
  });

  it('refuses a private or non-http URL, storing nothing', async () => {
    checker.isPublic.mockResolvedValue(false);
    const before = await counts();
    const { body } = await as('u1', 'post', `/${spaceId}/monitors`).send({ id: newId, name: 'Router', url: 'http://192.168.1.1', kind: 'web' }).expect(400);
    expect(body.message).toBe('Public addresses only');
    expect(await counts()).toEqual(before);
  });

  it('loads the space and one site', async () => {
    await as('u1', 'post', `/monitors/${siteId}/check`).expect(201);
    const { body } = await as('u1', 'get', `/${spaceId}`).expect(200);
    expect(body.monitors).toHaveLength(1);
    expect(body.monitors[0]).toMatchObject({ id: siteId, status: 'up' });
    const detail = await as('u1', 'get', `/monitors/${siteId}`).expect(200);
    expect(detail.body).toMatchObject({ id: siteId, uptime24h: 100, incidents: [] });
  });

  it('lets a viewer read but not add, edit, check or delete', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await as('u2', 'get', `/${spaceId}`).expect(200);
    await as('u2', 'get', `/monitors/${siteId}`).expect(200);
    const before = await counts();
    await as('u2', 'post', `/${spaceId}/monitors`).send({ id: newId, name: 'X', url: 'https://x.example', kind: 'web' }).expect(403);
    await as('u2', 'patch', `/monitors/${siteId}`).send({ paused: true }).expect(403);
    await as('u2', 'post', `/monitors/${siteId}/check`).expect(403);
    await as('u2', 'delete', `/monitors/${siteId}`).expect(403);
    expect(await counts()).toEqual(before);
  });

  it('lets an editor add a site, stored under the owner', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    await as('u2', 'post', `/${spaceId}/monitors`).send({ id: newId, name: 'X', url: 'https://x.example', kind: 'web' }).expect(201);
    expect((await db.select().from(uptimeMonitors)).every(({ userId }) => userId === 'u1')).toBe(true);
  });

  it.each([
    ['GET space', 'get', '/SPACE', undefined],
    ['GET site', 'get', '/monitors/SITE', undefined],
    ['POST site', 'post', '/SPACE/monitors', { id: newId, name: 'X', url: 'https://x.example', kind: 'web' }],
    ['PATCH site', 'patch', '/monitors/SITE', { name: 'Hacked' }],
    ['POST check', 'post', '/monitors/SITE/check', undefined],
    ['DELETE site', 'delete', '/monitors/SITE', undefined],
  ] as [string, Method, string, object | undefined][])('answers 404 to a stranger on %s, changing nothing', async (_, method, path, body) => {
    const before = await counts();
    await as('u3', method, fill(path)).send(body).expect(404);
    expect(await counts()).toEqual(before);
    expect(checker.check).not.toHaveBeenCalled();
  });

  it('asks for the password on reads of a locked space', async () => {
    await db.update(spaces).set({ lockHash: 'scrypt$c2FsdA$aGFzaA' }).where(eq(spaces.id, spaceId));
    for (const path of [`/${spaceId}`, `/monitors/${siteId}`]) {
      const res = await as('u1', 'get', path);
      expect(res.status, path).toBe(403);
      expect(res.body.message).toBe('This space is locked');
    }
  });

  it('limits Check now to once every 10 s', async () => {
    await as('u1', 'post', `/monitors/${siteId}/check`).expect(201);
    const { body } = await as('u1', 'post', `/monitors/${siteId}/check`).expect(429);
    expect(body.message).toBe('Wait a few seconds before checking again');
  });

  it('pauses a site so it is no longer due, and tells the sidebar', async () => {
    const { body } = await as('u1', 'patch', `/monitors/${siteId}`).send({ paused: true }).expect(200);
    expect(body).toMatchObject({ id: siteId, paused: true });
    expect(await new UptimeService(db).due()).toEqual([]);
    expect(notifier.changed).toHaveBeenCalledWith(spaceId);
  });

  it('saves a rename without checking the site again, even when its DNS is broken', async () => {
    checker.isPublic.mockResolvedValue(false);
    const { body } = await as('u1', 'patch', `/monitors/${siteId}`).send({ name: 'Gym API v2', url: 'https://api.gym.example/api/health', kind: 'api' }).expect(200);
    expect(body.name).toBe('Gym API v2');
    expect(checker.check).not.toHaveBeenCalled();
    expect(checker.isPublic).not.toHaveBeenCalled();
  });

  it('checks again when the URL changes, refusing a private one', async () => {
    checker.check.mockResolvedValue(down);
    const { body } = await as('u1', 'patch', `/monitors/${siteId}`).send({ url: 'https://new.example/health' }).expect(200);
    expect(checker.check).toHaveBeenCalledWith('https://new.example/health');
    expect(body).toMatchObject({ url: 'https://new.example/health', status: 'down', lastError: '502 Bad Gateway' });
    checker.isPublic.mockResolvedValue(false);
    await as('u1', 'patch', `/monitors/${siteId}`).send({ url: 'http://10.0.0.1' }).expect(400);
  });

  it('deletes a site with its checks and incidents', async () => {
    checker.check.mockResolvedValue(down);
    await as('u1', 'post', `/monitors/${siteId}/check`).expect(201);
    await as('u1', 'delete', `/monitors/${siteId}`).expect(200);
    expect(await counts()).toEqual([0, 0, 0]);
  });

  it('404s a space that is not an Uptime space', async () => {
    const list = await insertSpace(db, 'u1', { tool: 'list' });
    await as('u1', 'get', `/${list}`).expect(404);
    await as('u1', 'post', `/${list}/monitors`).send({ id: newId, name: 'X', url: 'https://x.example', kind: 'web' }).expect(404);
  });

  it('refuses a bad body', async () => {
    await as('u1', 'post', `/${spaceId}/monitors`).send({ id: newId, name: '', url: 'https://x.example', kind: 'web' }).expect(400);
    await as('u1', 'post', `/${spaceId}/monitors`).send({ id: newId, name: 'X', url: 'https://x.example', kind: 'ftp' }).expect(400);
  });
});
