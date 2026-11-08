import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
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

  const http = () => request(app.getHttpServer());
  const post = (url: string, body: object) => http().post(url).set('x-test-user', 'u1').send(body);
  const listToday = () =>
    http().get(`/api/tasks?from=${today}&to=${today}&today=${today}`).set('x-test-user', 'u1');

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        TasksService,
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
    await post('/api/tasks', { title, day: today }).expect(400);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it('answers 400 for an impossible date', async () => {
    await post('/api/tasks', { title: 'x', day: '2026-02-31' }).expect(400);
  });

  it('accepts a 200-character title and trims spaces', async () => {
    await post('/api/tasks', { title: `  ${'a'.repeat(200)}  `, day: today }).expect(201);
    const { body } = await listToday().expect(200);
    expect(body[0].title).toBe('a'.repeat(200));
  });

  it('answers 400 for an unknown status', async () => {
    await post('/api/tasks', { title: 'x', day: today, status: 'nope' }).expect(400);
  });

  it('answers 400 for a list request with no today', async () => {
    await http().get(`/api/tasks?from=${today}&to=${today}`).set('x-test-user', 'u1').expect(400);
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
      .values({ userId: 'u2', title: 'x', plannedDay: today })
      .returning();
    await http()
      .put(`/api/tasks/${other.id}/finished`)
      .set('x-test-user', 'u1')
      .send({ finished: true, today })
      .expect(404);
  });

  it('creates a task and lists it', async () => {
    await post('/api/tasks', { title: 'x', day: today, highPriority: true }).expect(201);
    const { body } = await listToday().expect(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ title: 'x', highPriority: true, day: today, subtasks: [] });
  });

  it('adds a subtask, changes, finishes and deletes through the API', async () => {
    await post('/api/tasks', { title: 'p', day: today }).expect(201);
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
