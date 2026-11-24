import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { focusSessions } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { FocusController } from './focus-controller.ts';
import { FocusService } from './focus-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

const session = (id: string, day: string, extra: object = {}) => ({ id, day, startedAt: `${day}T09:00:00.000Z`, minutes: 25, ...extra });
const ids = ['6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c20', '7a2d2f6f-4b4f-4b4a-8e7f-1b2e9f7c3d31', '8b3e3a7a-5c5a-4c5b-9f8a-2c3fa08d4e42'];
const range = '?from=2026-11-18&to=2026-11-24';

describe('focus API', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;
  const as = (user: string, method: 'get' | 'post' | 'put', path: string) => request(app.getHttpServer())[method](`/api/focus${path}`).set('x-test-user', user);

  beforeEach(async () => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
    db = await createTestDb();
    for (const id of ['u1', 'u2', 'u3']) await insertUser(db, id);
    spaceId = await insertSpace(db, 'u1', { tool: 'focus' });
    const moduleRef = await Test.createTestingModule({
      controllers: [FocusController],
      providers: [FocusService, SpaceAccessService, SpaceLockService, AuthGuard, { provide: DB, useValue: db }, { provide: AUTH, useValue: fakeAuth }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('starts with the default timer lengths and no sessions', async () => {
    const response = await as('u1', 'get', `/${spaceId}${range}`).expect(200);
    expect(response.body).toEqual({ settings: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 }, sessions: [] });
  });

  it('records sessions once each, in a range, oldest first, with the task copied in', async () => {
    await as('u1', 'post', `/${spaceId}/sessions`).send(session(ids[1], '2026-11-24', { taskId: ids[2], taskTitle: 'Write the report' })).expect(201);
    await as('u1', 'post', `/${spaceId}/sessions`).send(session(ids[0], '2026-11-20')).expect(201);
    await as('u1', 'post', `/${spaceId}/sessions`).send(session(ids[0], '2026-11-20')).expect(201);
    await as('u1', 'post', `/${spaceId}/sessions`).send(session(ids[2], '2026-11-01')).expect(201);
    const { body } = await as('u1', 'get', `/${spaceId}${range}`).expect(200);
    expect(body.sessions).toEqual([
      { id: ids[0], day: '2026-11-20', startedAt: '2026-11-20T09:00:00.000Z', minutes: 25, taskId: null, taskTitle: null },
      { id: ids[1], day: '2026-11-24', startedAt: '2026-11-24T09:00:00.000Z', minutes: 25, taskId: ids[2], taskTitle: 'Write the report' },
    ]);
  });

  it('saves timer lengths and refuses ones out of range', async () => {
    const settings = { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 30, longBreakEvery: 3 };
    await as('u1', 'put', `/${spaceId}/settings`).send(settings).expect(200);
    await as('u1', 'put', `/${spaceId}/settings`).send({ ...settings, focusMinutes: 0 }).expect(400);
    expect((await as('u1', 'get', `/${spaceId}${range}`)).body.settings).toEqual(settings);
  });

  it('lets a viewer read but not record, an editor record under the owner, and a stranger nothing', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await as('u2', 'get', `/${spaceId}${range}`).expect(200);
    await as('u2', 'post', `/${spaceId}/sessions`).send(session(ids[0], '2026-11-24')).expect(403);
    await as('u3', 'get', `/${spaceId}${range}`).expect(404);
    await as('u3', 'post', `/${spaceId}/sessions`).send(session(ids[0], '2026-11-24')).expect(404);
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u3@example.com', role: 'edit' });
    await as('u3', 'post', `/${spaceId}/sessions`).send(session(ids[0], '2026-11-24')).expect(201);
    expect(await db.select({ userId: focusSessions.userId }).from(focusSessions)).toEqual([{ userId: 'u1' }]);
  });

  it('answers 404 for a space that is not a Focus space, and 400 for a bad range', async () => {
    const list = await insertSpace(db, 'u1', { tool: 'list' });
    await as('u1', 'get', `/${list}${range}`).expect(404);
    await as('u1', 'post', `/${list}/sessions`).send(session(ids[0], '2026-11-24')).expect(404);
    await as('u1', 'get', `/${spaceId}?from=2026-11-24&to=2026-11-18`).expect(400);
  });
});
