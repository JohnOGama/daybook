import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { oauthClient, oauthConsent } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { ConnectedAppsController } from './connected-apps-controller.ts';
import { ConnectedAppsService } from './connected-apps-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

describe('connected apps API', () => {
  let app: INestApplication;
  let db: Db;
  const as = (user: string | null, method: 'get' | 'delete', path = '') => {
    const call = request(app.getHttpServer())[method](`/api/connected-apps${path}`);
    return user ? call.set('x-test-user', user) : call;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await db.insert(oauthClient).values({ id: 'c1', clientId: 'client-1', name: 'Claude', redirectUris: ['https://claude.ai/cb'], createdAt: new Date() });
    await db.insert(oauthConsent).values({ id: 'consent-1', clientId: 'client-1', userId: 'u1', scopes: ['openid', 'fitness'], createdAt: new Date('2026-11-21T08:00:00Z') });
    const moduleRef = await Test.createTestingModule({
      controllers: [ConnectedAppsController],
      providers: [ConnectedAppsService, AuthGuard, { provide: DB, useValue: db }, { provide: AUTH, useValue: fakeAuth }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('lists and disconnects the signed-in person’s apps', async () => {
    const { body } = await as('u1', 'get').expect(200);
    expect(body).toEqual([{ id: 'consent-1', name: 'Claude', connectedAt: '2026-11-21T08:00:00.000Z', scopes: ['openid', 'fitness'] }]);
    await as('u1', 'delete', '/consent-1').expect(200);
    expect((await as('u1', 'get').expect(200)).body).toEqual([]);
  });

  it('answers 404 for an app that is not theirs, and 401 without a session', async () => {
    await insertUser(db, 'u2');
    await as('u2', 'delete', '/consent-1').expect(404);
    await as(null, 'get').expect(401);
  });
});
