import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { securityFindings } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { SecurityController } from './security-controller.ts';
import { SecurityService } from './security-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

type Method = 'get' | 'post' | 'patch' | 'delete';

describe('security API', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;
  let findingId: string;
  const newId = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c20';
  const as = (user: string, method: Method, path: string) => request(app.getHttpServer())[method](`/api/security${path}`).set('x-test-user', user);

  beforeEach(async () => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
    db = await createTestDb();
    for (const id of ['u1', 'u2', 'u3']) await insertUser(db, id);
    spaceId = await insertSpace(db, 'u1', { tool: 'security' });
    const [row] = await db.insert(securityFindings).values({ id: newId.replace('20', '21'), spaceId, userId: 'u1', title: 'Reflected XSS on search', target: 'https://app.example/search', severity: 'high', cvss: 73 }).returning();
    findingId = row.id;
    const moduleRef = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [SecurityService, SpaceAccessService, SpaceLockService, AuthGuard, { provide: DB, useValue: db }, { provide: AUTH, useValue: fakeAuth }, { provide: BudgetAiService, useValue: { enabled: false, analyzeSurface: async () => [] } }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('adds a finding and returns it', async () => {
    const { body } = await as('u1', 'post', `/${spaceId}/findings`).send({ id: newId, title: ' SQLi in /login ', severity: 'critical', cvss: 98, target: 'https://app.example/login' }).expect(201);
    expect(body).toMatchObject({ id: newId, title: 'SQLi in /login', severity: 'critical', status: 'open', cvss: 98 });
  });

  it('loads a space with its findings, newest first', async () => {
    await as('u1', 'post', `/${spaceId}/findings`).send({ id: newId, title: 'Open redirect', severity: 'low' }).expect(201);
    const { body } = await as('u1', 'get', `/${spaceId}`).expect(200);
    expect(body.findings).toHaveLength(2);
    expect(body.findings[0].id).toBe(newId);
  });

  it('updates a finding status', async () => {
    const { body } = await as('u1', 'patch', `/findings/${findingId}`).send({ status: 'fixed' }).expect(200);
    expect(body.status).toBe('fixed');
  });

  it('deletes a finding', async () => {
    await as('u1', 'delete', `/findings/${findingId}`).expect(200);
    expect(await db.select().from(securityFindings)).toHaveLength(0);
  });

  it('rejects a bad severity', async () => {
    await as('u1', 'post', `/${spaceId}/findings`).send({ id: newId, title: 'x', severity: 'catastrophic' }).expect(400);
  });

  it('hides the space from a stranger (404) and refuses a view-only write (403)', async () => {
    await as('u2', 'get', `/${spaceId}`).expect(404);
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u3@example.com', role: 'view' });
    await as('u3', 'get', `/${spaceId}`).expect(200);
    await as('u3', 'post', `/${spaceId}/findings`).send({ id: newId, title: 'x', severity: 'low' }).expect(403);
  });

  it('refuses a scan unless authorization is confirmed, before any request', async () => {
    await as('u1', 'post', `/${spaceId}/scan`).send({ url: 'https://app.example' }).expect(400);
    await as('u1', 'post', `/${spaceId}/scan`).send({ url: 'https://app.example', authorized: false }).expect(400);
  });

  it('404s a non-security space', async () => {
    const listSpace = await insertSpace(db, 'u1', { tool: 'list' });
    await as('u1', 'get', `/${listSpace}`).expect(404);
  });
});
