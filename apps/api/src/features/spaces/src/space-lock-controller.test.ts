import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService } from './space-access-service.ts';
import { SpaceLockController } from './space-lock-controller.ts';
import { SpaceLockService } from './space-lock-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

describe('space lock API for shared users', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;

  const as = (user: string, method: 'get' | 'post' | 'put', path: string) =>
    request(app.getHttpServer())[method](`/api/spaces/${spaceId}/${path}`).set('x-test-user', user);

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
  });

  beforeEach(async () => {
    db = await createTestDb();
    for (const id of ['u1', 'u2', 'u3']) await insertUser(db, id);
    spaceId = await insertSpace(db, 'u1', { tool: 'notebook' });
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const moduleRef = await Test.createTestingModule({
      controllers: [SpaceLockController],
      providers: [
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

  const lockAsOwner = async () => {
    const res = await as('u1', 'put', 'lock').send({ password: 'secret-pass' }).expect(200);
    return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  };

  it('lets a shared user unlock with the password, with their own cookie', async () => {
    await lockAsOwner();
    expect((await as('u2', 'get', 'unlock').expect(200)).body).toEqual({ unlocked: false });
    const res = await as('u2', 'post', 'unlock').send({ password: 'secret-pass' }).expect(201);
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect((await as('u2', 'get', 'unlock').set('Cookie', cookie).expect(200)).body).toEqual({ unlocked: true });
  });

  it("does not unlock for another user with the owner's cookie", async () => {
    const ownerCookie = await lockAsOwner();
    expect((await as('u2', 'get', 'unlock').set('Cookie', ownerCookie).expect(200)).body).toEqual({ unlocked: false });
  });

  it('answers 404 when a shared user sets the password', async () => {
    await as('u2', 'put', 'lock').send({ password: 'secret-pass' }).expect(404);
  });

  it('answers 404 when an unshared user unlocks', async () => {
    await lockAsOwner();
    await as('u3', 'post', 'unlock').send({ password: 'secret-pass' }).expect(404);
  });
});
