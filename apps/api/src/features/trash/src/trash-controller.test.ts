import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { TrashController } from './trash-controller.ts';
import { TrashService } from './trash-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

describe('trash API', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;
  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    spaceId = await insertSpace(db, 'u1');
    const moduleRef = await Test.createTestingModule({
      controllers: [TrashController],
      providers: [TrashService, AuthGuard, { provide: DB, useValue: db }, { provide: AUTH, useValue: fakeAuth }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('answers 401 without a session', async () => {
    await http().get('/api/trash').expect(401);
  });

  it('lists and restores a task', async () => {
    const [task] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId, title: 'T', plannedDay: '2026-11-09', deletedAt: new Date() })
      .returning();
    const { body } = await http().get('/api/trash').set('x-test-user', 'u1').expect(200);
    expect(body[0]).toMatchObject({ id: task.id, type: 'task', title: 'T' });
    await http().post(`/api/trash/tasks/${task.id}/restore`).set('x-test-user', 'u1').expect(201);
    expect((await http().get('/api/trash').set('x-test-user', 'u1')).body).toEqual([]);
  });

  it('restores a space', async () => {
    const [space] = await db
      .insert(spaces)
      .values({ userId: 'u1', kind: 'space', title: 'S', tool: 'list', deletedAt: new Date() })
      .returning();
    await http().post(`/api/trash/spaces/${space.id}/restore`).set('x-test-user', 'u1').expect(201);
    expect((await http().get('/api/trash').set('x-test-user', 'u1')).body).toEqual([]);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    await http().post('/api/trash/tasks/nope/restore').set('x-test-user', 'u1').expect(400);
  });
});
