import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpacesController } from './spaces-controller.ts';
import { SpacesService } from './spaces-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

describe('spaces API', () => {
  let app: INestApplication;
  let db: Db;

  const post = (body: object) =>
    request(app.getHttpServer()).post('/api/spaces').set('x-test-user', 'u1').send(body);

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    const moduleRef = await Test.createTestingModule({
      controllers: [SpacesController],
      providers: [
        SpacesService,
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
    await request(app.getHttpServer()).get('/api/spaces?today=2026-11-09').expect(401);
  });

  it('answers 400 for a list with no today', async () => {
    await request(app.getHttpServer()).get('/api/spaces').set('x-test-user', 'u1').expect(400);
  });

  it('creates a space and lists it', async () => {
    const { body } = await post({ kind: 'space', title: '  Home  ', tool: 'list' }).expect(201);
    expect(body).toMatchObject({ title: 'Home', tool: 'list' });
    const listed = await request(app.getHttpServer())
      .get('/api/spaces?today=2026-11-09')
      .set('x-test-user', 'u1')
      .expect(200);
    expect(listed.body.map((s: { id: string }) => s.id)).toEqual([body.id]);
  });

  it.each([
    ['a blank title', { kind: 'space', title: '   ', tool: 'list' }],
    ['a long title', { kind: 'folder', title: 'a'.repeat(201) }],
    ['a space with no tool', { kind: 'space', title: 'x' }],
    ['an unknown tool', { kind: 'space', title: 'x', tool: 'nope' }],
    ['a folder inside a folder', { kind: 'folder', title: 'x', parentId: '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11' }],
    ['an unknown kind', { kind: 'nope', title: 'x' }],
  ])('answers 400 for %s, saves nothing', async (_, body) => {
    await post(body).expect(400);
    expect(await db.select().from(spaces)).toHaveLength(0);
  });

  it('renames a space, trimming the title', async () => {
    const { body } = await post({ kind: 'space', title: 'Old', tool: 'list' }).expect(201);
    await request(app.getHttpServer())
      .patch(`/api/spaces/${body.id}`)
      .set('x-test-user', 'u1')
      .send({ title: '  New  ' })
      .expect(200);
    expect((await db.select().from(spaces))[0].title).toBe('New');
  });

  it('answers 400 for a blank new title', async () => {
    const { body } = await post({ kind: 'space', title: 'Old', tool: 'list' }).expect(201);
    await request(app.getHttpServer())
      .patch(`/api/spaces/${body.id}`)
      .set('x-test-user', 'u1')
      .send({ title: '   ' })
      .expect(400);
  });

  it('duplicates a space', async () => {
    const { body } = await post({ kind: 'space', title: 'Home', tool: 'list' }).expect(201);
    const copy = await request(app.getHttpServer())
      .post(`/api/spaces/${body.id}/duplicate`)
      .set('x-test-user', 'u1')
      .send({})
      .expect(201);
    expect(copy.body.title).toBe('Home (copy)');
  });

  it('deletes a space', async () => {
    const { body } = await post({ kind: 'space', title: 'Home', tool: 'list' }).expect(201);
    await request(app.getHttpServer()).delete(`/api/spaces/${body.id}`).set('x-test-user', 'u1').expect(200);
    expect((await db.select().from(spaces))[0].deletedAt).not.toBeNull();
  });

  it('answers 400 for a delete with an id that is not a UUID', async () => {
    await request(app.getHttpServer()).delete('/api/spaces/nope').set('x-test-user', 'u1').expect(400);
  });

  it('ignores a tool sent with a folder', async () => {
    const { body } = await post({ kind: 'folder', title: 'x', tool: 'list' }).expect(201);
    expect(body.tool).toBeNull();
  });
});
