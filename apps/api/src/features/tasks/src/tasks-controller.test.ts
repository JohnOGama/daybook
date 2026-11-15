import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { unlockCookieName } from '../../spaces/src/space-lock-service.ts';
import { TasksController } from './tasks-controller.ts';
import { TasksService } from './tasks-service.ts';

type Ctx = { edit: string; task: string };
const today = '2026-11-09';
const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

describe('tasks API', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;

  const http = () => request(app.getHttpServer());
  const post = (url: string, body: object) => http().post(url).set('x-test-user', 'u1').send(body);
  const listToday = () =>
    http().get(`/api/tasks?spaceId=${spaceId}&from=${today}&to=${today}&today=${today}`).set('x-test-user', 'u1');

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    spaceId = await insertSpace(db, 'u1');
    await insertUser(db, 'u2');
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        TasksService,
        SpaceLockService,
        SpaceAccessService,
        AuthGuard,
        { provide: DB, useValue: db },
        { provide: AUTH, useValue: fakeAuth },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('answers 401 without a session', async () => {
    await http().get('/api/tasks').expect(401);
  });

  it.each([['   '], ['a'.repeat(201)]])('answers 400 for title %j, saves nothing', async (title) => {
    await post('/api/tasks', { spaceId, title, day: today }).expect(400);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it('answers 400 for an impossible date', async () => {
    await post('/api/tasks', { spaceId, title: 'x', day: '2026-02-31' }).expect(400);
  });

  it('accepts a 200-character title and trims spaces', async () => {
    await post('/api/tasks', { spaceId, title: `  ${'a'.repeat(200)}  `, day: today }).expect(201);
    const { body } = await listToday().expect(200);
    expect(body[0].title).toBe('a'.repeat(200));
  });

  it('answers 400 for an unknown status', async () => {
    await post('/api/tasks', { spaceId, title: 'x', day: today, status: 'nope' }).expect(400);
  });

  it('answers 400 for a list request with no today', async () => {
    await http().get(`/api/tasks?spaceId=${spaceId}&from=${today}&to=${today}`).set('x-test-user', 'u1').expect(400);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    await http()
      .put('/api/tasks/not-a-uuid/finished')
      .set('x-test-user', 'u1')
      .send({ finished: true, today })
      .expect(400);
  });

  it("answers 404 when finishing another user's task", async () => {
    const [other] = await db
      .insert(tasks)
      .values({ userId: 'u2', spaceId: await insertSpace(db, 'u2'), title: 'x', plannedDay: today })
      .returning();
    await http()
      .put(`/api/tasks/${other.id}/finished`)
      .set('x-test-user', 'u1')
      .send({ finished: true, today })
      .expect(404);
  });

  it('refuses to list a locked space until it is unlocked', async () => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
    const token = await new SpaceLockService(db).setPassword('u1', spaceId, 'secret');
    expect((await listToday()).status).toBe(403);
    const unlocked = await listToday().set('Cookie', `${unlockCookieName(spaceId)}=${token}`);
    expect(unlocked.status).toBe(200);
  });

  it('creates a task and lists it', async () => {
    await post('/api/tasks', { spaceId, title: 'x', day: today, highPriority: true }).expect(201);
    const { body } = await listToday().expect(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ title: 'x', highPriority: true, day: today, subtasks: [] });
  });

  it('copies a task through the API', async () => {
    await post('/api/tasks', { spaceId, title: 'p', day: today }).expect(201);
    const id = (await listToday()).body[0].id;
    await post(`/api/tasks/${id}/copy`, { today }).expect(201);
    expect((await listToday()).body.map((t: { title: string }) => t.title)).toEqual(['p', 'p (copy)']);
  });

  it('copies a task to another space through the API', async () => {
    await post('/api/tasks', { spaceId, title: 'p', day: today }).expect(201);
    const id = (await listToday()).body[0].id;
    const other = await insertSpace(db, 'u1');
    await post(`/api/tasks/${id}/copy`, { today, spaceId: other }).expect(201);
    const { body } = await http()
      .get(`/api/tasks?spaceId=${other}&from=${today}&to=${today}&today=${today}`)
      .set('x-test-user', 'u1');
    expect(body.map((t: { title: string }) => t.title)).toEqual(['p']);
  });

  it('answers 400 for a copy to a space id that is not a UUID', async () => {
    await post('/api/tasks', { spaceId, title: 'p', day: today }).expect(201);
    const id = (await listToday()).body[0].id;
    await post(`/api/tasks/${id}/copy`, { today, spaceId: 'nope' }).expect(400);
  });

  it('reorders tasks through the API', async () => {
    await post('/api/tasks', { spaceId, title: 'a', day: today }).expect(201);
    await post('/api/tasks', { spaceId, title: 'b', day: today }).expect(201);
    const ids = (await listToday()).body.map((t: { id: string }) => t.id);
    await http().put('/api/tasks/order').set('x-test-user', 'u1').send({ ids: [...ids].reverse() }).expect(200);
    expect((await listToday()).body.map((t: { title: string }) => t.title)).toEqual(['b', 'a']);
  });

  it('answers 400 for an empty or invalid order', async () => {
    await http().put('/api/tasks/order').set('x-test-user', 'u1').send({ ids: [] }).expect(400);
    await http().put('/api/tasks/order').set('x-test-user', 'u1').send({ ids: ['nope'] }).expect(400);
  });

  it('answers 400 for a copy with no today', async () => {
    await post('/api/tasks', { spaceId, title: 'p', day: today }).expect(201);
    const id = (await listToday()).body[0].id;
    await post(`/api/tasks/${id}/copy`, {}).expect(400);
  });

  it('adds a subtask, changes, finishes and deletes through the API', async () => {
    await post('/api/tasks', { spaceId, title: 'p', day: today }).expect(201);
    const parentId = (await listToday()).body[0].id;
    await post(`/api/tasks/${parentId}/subtasks`, { title: 's' }).expect(201);
    const subId = (await listToday()).body[0].subtasks[0].id;
    await http()
      .patch(`/api/tasks/${parentId}`)
      .set('x-test-user', 'u1')
      .send({ status: 'on_hold' })
      .expect(200);
    await http()
      .put(`/api/tasks/${subId}/finished`)
      .set('x-test-user', 'u1')
      .send({ finished: true, today })
      .expect(200);
    expect((await listToday()).body[0]).toMatchObject({ finished: true, status: 'on_hold' });
    await http().delete(`/api/tasks/${parentId}?today=${today}`).set('x-test-user', 'u1').expect(200);
    expect((await listToday()).body).toHaveLength(0);
  });

  describe('shared access', () => {
    const as = (user: string) => ({
      get: (url: string) => http().get(url).set('x-test-user', user),
      post: (url: string, body: object = {}) => http().post(url).set('x-test-user', user).send(body),
      put: (url: string, body: object = {}) => http().put(url).set('x-test-user', user).send(body),
      patch: (url: string, body: object = {}) => http().patch(url).set('x-test-user', user).send(body),
    });
    let editSpace: string;
    let viewSpace: string;
    let privateSpace: string;
    let editTask: string;
    let viewTask: string;
    let privateTask: string;

    const addTask = async (userId: string, sid: string) =>
      (await db.insert(tasks).values({ userId, spaceId: sid, title: 't', plannedDay: today }).returning())[0].id;

    beforeEach(async () => {
      await insertUser(db, 'u3');
      editSpace = spaceId;
      viewSpace = await insertSpace(db, 'u1');
      privateSpace = await insertSpace(db, 'u1');
      await insertShare(db, { spaceId: editSpace, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
      await insertShare(db, { spaceId: viewSpace, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      editTask = await addTask('u1', editSpace);
      viewTask = await addTask('u1', viewSpace);
      privateTask = await addTask('u1', privateSpace);
    });

    it('lets an editor create a task owned by the space owner', async () => {
      const id = crypto.randomUUID();
      await as('u2').post('/api/tasks', { id, spaceId: editSpace, title: 'x', day: today }).expect(201);
      const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
      expect(row.userId).toBe('u1');
    });

    it('lets a viewer list but not change', async () => {
      await as('u2').get(`/api/tasks?spaceId=${viewSpace}&from=${today}&to=${today}&today=${today}`).expect(200);
      await as('u2').patch(`/api/tasks/${viewTask}`, { title: 'z' }).expect(403);
    });

    it('answers 404 to a user with no share on a list', async () => {
      await as('u3').get(`/api/tasks?spaceId=${editSpace}&from=${today}&to=${today}&today=${today}`).expect(404);
    });

    it.each([
      ['POST', '/tasks', (c: Ctx) => ({ spaceId: c.edit, title: 'x', day: today })],
      ['POST', '/tasks/bulk', (c: Ctx) => ({ spaceId: c.edit, day: today, tasks: [{ id: crypto.randomUUID(), title: 'x', subtasks: [] }] })],
      ['POST', '/tasks/bulk-delete', (c: Ctx) => ({ ids: [c.task] })],
      ['POST', '/tasks/:id/subtasks', () => ({ title: 'x' })],
      ['POST', '/tasks/:id/subtasks/bulk', () => ({ subtasks: [{ id: crypto.randomUUID(), title: 'x', subtasks: [] }] })],
      ['PATCH', '/tasks/:id', () => ({ title: 'x' })],
      ['PUT', '/tasks/:id/finished', () => ({ finished: true, today })],
      ['POST', '/tasks/:id/copy', () => ({ today })],
      ['PUT', '/tasks/order', (c: Ctx) => ({ ids: [c.task] })],
      ['DELETE', `/tasks/:id?today=${today}`, () => ({})],
    ])('answers 404 to a user with no share: %s %s', async (method, path, makeBody) => {
      const url = `/api${path.replace(':id', editTask)}`;
      const req = http()[method.toLowerCase() as 'post'](url).set('x-test-user', 'u3');
      await (method === 'DELETE' ? req : req.send(makeBody({ edit: editSpace, task: editTask }))).expect(404);
      const rows = await db.select().from(tasks);
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.deletedAt === null && r.title === 't')).toBe(true);
    });

    it('answers 404 for a bulk delete mixing a shared and a private task, deleting neither', async () => {
      await as('u2').post('/api/tasks/bulk-delete', { ids: [editTask, privateTask] }).expect(404);
      const rows = await db.select().from(tasks);
      expect(rows.every((r) => r.deletedAt === null)).toBe(true);
    });

    it('answers 404 for a reorder mixing a shared and a private task', async () => {
      await as('u2').put('/api/tasks/order', { ids: [editTask, privateTask] }).expect(404);
    });

    it("answers 400 copying from a shared space into the editor's own space", async () => {
      const own = await insertSpace(db, 'u2');
      await as('u2').post(`/api/tasks/${editTask}/copy`, { today, spaceId: own }).expect(400);
      expect(await db.select().from(tasks)).toHaveLength(3);
    });

    it("answers 404 copying into the owner's private space", async () => {
      await as('u2').post(`/api/tasks/${editTask}/copy`, { today, spaceId: privateSpace }).expect(404);
      expect(await db.select().from(tasks)).toHaveLength(3);
    });
  });
});
