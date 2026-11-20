import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { pipelineRuns, spaces, spaceShares, tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertFolder, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService } from './space-access-service.ts';
import { SpaceGroupsService } from './space-groups-service.ts';
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
    await insertUser(db, 'u2');
    const moduleRef = await Test.createTestingModule({
      controllers: [SpacesController],
      providers: [
        SpacesService,
        SpaceAccessService,
        SpaceGroupsService,
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

  it('lists the pipelines status for a pipelines space and null for others', async () => {
    const list = (await post({ kind: 'space', title: 'Home', tool: 'list' }).expect(201)).body;
    const ci = (await post({ kind: 'space', title: 'Backend', tool: 'pipelines' }).expect(201)).body;
    expect(ci.pipelines).toBeNull();
    await db.insert(pipelineRuns).values({ spaceId: ci.id, userId: 'u1', job: 'api', number: 1, status: 'running' });
    const listed = (await request(app.getHttpServer()).get('/api/spaces?today=2026-11-09').set('x-test-user', 'u1').expect(200)).body;
    const byId = new Map(listed.map((s: { id: string; pipelines: unknown }) => [s.id, s.pipelines]));
    expect(byId.get(ci.id)).toBe('running');
    expect(byId.get(list.id)).toBeNull();
  });

  it('refuses to duplicate a pipelines space', async () => {
    const ci = (await post({ kind: 'space', title: 'Backend', tool: 'pipelines' }).expect(201)).body;
    await request(app.getHttpServer()).post(`/api/spaces/${ci.id}/duplicate`).set('x-test-user', 'u1').send({}).expect(400);
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

  describe('sharing', () => {
    const as = (userId: string) => ({
      get: (url: string) => request(app.getHttpServer()).get(`/api${url}`).set('x-test-user', userId),
      post: (url: string, body: object = {}) => request(app.getHttpServer()).post(`/api${url}`).set('x-test-user', userId).send(body),
      patch: (url: string, body: object) => request(app.getHttpServer()).patch(`/api${url}`).set('x-test-user', userId).send(body),
      put: (url: string, body: object) => request(app.getHttpServer()).put(`/api${url}`).set('x-test-user', userId).send(body),
      delete: (url: string) => request(app.getHttpServer()).delete(`/api${url}`).set('x-test-user', userId),
    });
    const listFor = async (userId: string) =>
      (await as(userId).get('/spaces?today=2026-11-15').expect(200)).body as Record<string, unknown>[];
    const shareId = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
    const otherShareId = '7a1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';

    it('lists a shared folder and its spaces for the recipient, and marks the owner row shared', async () => {
      const folder = await insertFolder(db, 'u1');
      const inner = await insertSpace(db, 'u1', { parentId: folder });
      await insertSpace(db, 'u1', { title: 'Private' });
      await as('u1').post(`/spaces/${folder}/shares`, { id: shareId, email: 'u2@example.com', role: 'view' }).expect(201);

      const theirs = await listFor('u2');
      expect(theirs.map((s) => s.id).sort()).toEqual([folder, inner].sort());
      for (const space of theirs) expect(space).toMatchObject({ access: 'view', ownerName: 'u1', ownerId: 'u1' });

      const mine = await listFor('u1');
      expect(mine.find((s) => s.id === folder)).toMatchObject({ shared: true, access: 'owner', ownerId: 'u1', ownerName: null });
      expect(mine.find((s) => s.id === inner)).toMatchObject({ shared: false, access: 'owner' });
    });

    it('sends a shared locked space as locked, never its hash', async () => {
      const space = await insertSpace(db, 'u1', { lockHash: 'secret-hash' });
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
      const [shared] = await listFor('u2');
      expect(shared).toMatchObject({ id: space, locked: true, access: 'edit' });
      expect(shared).not.toHaveProperty('lockHash');
    });

    it('answers the same for an email with no account, trimming and lowercasing it', async () => {
      const space = await insertSpace(db, 'u1');
      const known = await as('u1').post(`/spaces/${space}/shares`, { id: shareId, email: 'u2@example.com', role: 'edit' }).expect(201);
      const unknown = await as('u1')
        .post(`/spaces/${space}/shares`, { id: otherShareId, email: '  Nobody@Example.COM ', role: 'view' })
        .expect(201);
      expect(Object.keys(unknown.body).sort()).toEqual(Object.keys(known.body).sort());
      expect(unknown.body).toEqual({ id: otherShareId, email: 'nobody@example.com', role: 'view' });
    });

    it('keeps the existing share id when sharing the same email again', async () => {
      const space = await insertSpace(db, 'u1');
      const existing = await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      const { body } = await as('u1').post(`/spaces/${space}/shares`, { id: shareId, email: 'U2@example.com', role: 'edit' }).expect(201);
      expect(body).toEqual({ id: existing, email: 'u2@example.com', role: 'edit' });
      expect((await as('u1').get(`/spaces/${space}/shares`).expect(200)).body).toEqual([body]);
    });

    it('changes and removes a share', async () => {
      const space = await insertSpace(db, 'u1');
      const id = await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      await as('u1').patch(`/spaces/${space}/shares/${id}`, { role: 'edit' }).expect(200);
      expect((await db.select().from(spaceShares))[0].role).toBe('edit');
      await as('u1').delete(`/spaces/${space}/shares/${id}`).expect(200);
      expect(await db.select().from(spaceShares)).toHaveLength(0);
    });

    it('refuses to share a vault or with your own email', async () => {
      const vault = await insertSpace(db, 'u1', { tool: 'vault' });
      const space = await insertSpace(db, 'u1');
      const vaultReply = await as('u1').post(`/spaces/${vault}/shares`, { id: shareId, email: 'u2@example.com', role: 'view' }).expect(400);
      expect(vaultReply.body.message).toBe("A vault can't be shared");
      const ownReply = await as('u1').post(`/spaces/${space}/shares`, { id: shareId, email: ' U1@Example.com', role: 'view' }).expect(400);
      expect(ownReply.body.message).toBe("That's your own email");
      expect(await db.select().from(spaceShares)).toHaveLength(0);
    });

    it('answers 404 to a recipient using owner-only routes, and changes nothing', async () => {
      const folder = await insertFolder(db, 'u1');
      const space = await insertSpace(db, 'u1', { title: 'Home', parentId: folder });
      const share = await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
      const before = await db.select().from(spaces);

      await as('u2').get(`/spaces/${space}/shares`).expect(404);
      await as('u2').post(`/spaces/${space}/shares`, { id: shareId, email: 'u3@example.com', role: 'edit' }).expect(404);
      await as('u2').patch(`/spaces/${space}/shares/${share}`, { role: 'view' }).expect(404);
      await as('u2').delete(`/spaces/${space}/shares/${share}`).expect(404);
      await as('u2').patch(`/spaces/${space}`, { title: 'Taken' }).expect(404);
      await as('u2').delete(`/spaces/${space}`).expect(404);
      await as('u2').put(`/spaces/${space}/parent`, { parentId: null }).expect(404);
      await as('u2').post(`/spaces/${space}/duplicate`).expect(404);
      await as('u2').put('/spaces/order', { ids: [space] }).expect(404);

      expect(await db.select().from(spaces)).toEqual(before);
      expect(await db.select().from(spaceShares)).toEqual([expect.objectContaining({ id: share, role: 'edit' })]);
    });

    it('lets a recipient leave a share made to them', async () => {
      const space = await insertSpace(db, 'u1');
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      await as('u2').delete(`/spaces/${space}/shares/me`).expect(200);
      expect(await listFor('u2')).toEqual([]);
      await as('u2').delete(`/spaces/${space}/shares/me`).expect(404);
    });

    it('answers 404 when leaving a space reached only through its folder', async () => {
      const folder = await insertFolder(db, 'u1');
      const space = await insertSpace(db, 'u1', { parentId: folder });
      await insertShare(db, { spaceId: folder, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      await as('u2').delete(`/spaces/${space}/shares/me`).expect(404);
      expect(await db.select().from(spaceShares)).toHaveLength(1);
    });

    it("counts the owner's tasks due today on a shared list space", async () => {
      const space = await insertSpace(db, 'u1', { carryOver: true });
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      await db.insert(tasks).values([
        { userId: 'u1', spaceId: space, title: 'Today', plannedDay: '2026-11-15' },
        { userId: 'u1', spaceId: space, title: 'Overdue', plannedDay: '2026-11-10' },
        { userId: 'u1', spaceId: space, title: 'Later', plannedDay: '2026-11-20' },
        { userId: 'u1', spaceId: space, title: 'Done', plannedDay: '2026-11-15', completedOn: '2026-11-15' },
      ]);
      expect((await listFor('u2'))[0].openToday).toBe(2);
    });
  });
});
