import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceLockService } from '../../spaces/index.ts';
import { unlockCookieName } from '../../spaces/src/space-lock-service.ts';
import { TasksController } from './tasks-controller.ts';
import { TasksService } from './tasks-service.ts';

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
});
