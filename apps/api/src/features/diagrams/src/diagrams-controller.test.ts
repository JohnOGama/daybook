import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { diagrams } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { DiagramsController } from './diagrams-controller.ts';
import { DiagramsService } from './diagrams-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};
const fakeAi = { enabled: true, editDiagram: async () => ({ dbml: 'Table a {\n  id int\n}', summary: 'Added a' }) };

describe('diagrams API sharing', () => {
  let app: INestApplication;
  let db: Db;
  let space: string;

  type Method = 'get' | 'post' | 'put';
  const as = (user: string, method: Method, url: string, body?: object) => {
    const req = request(app.getHttpServer())[method](`/api/diagrams${url}`).set('x-test-user', user);
    return body ? req.send(body) : req;
  };
  const snapshot = async () => JSON.stringify(await db.select().from(diagrams));

  // Every route, with a minimal valid request. It must match the controller's decorators.
  const routes = (): [string, Method, string, object?][] => [
    ['GET /', 'get', `?spaceId=${space}`],
    ['POST ai/edit', 'post', '/ai/edit', { spaceId: space, dbml: '', prompt: 'add a table' }],
  ];
  const labelled = (label: string) => routes().find(([name]) => name === label) as [string, Method, string, object?];
  const allLabels = routes().map(([label]) => label);
  const writeLabels = routes().filter(([, method]) => method !== 'get').map(([label]) => label);

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    const moduleRef = await Test.createTestingModule({
      controllers: [DiagramsController],
      providers: [
        DiagramsService,
        SpaceLockService,
        SpaceAccessService,
        AuthGuard,
        { provide: BudgetAiService, useValue: fakeAi },
        { provide: DB, useValue: db },
        { provide: AUTH, useValue: fakeAuth },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    space = await insertSpace(db, 'u1', { tool: 'diagram' });
    await app.get(DiagramsService).saveDoc('u1', space, { dbml: 'Table a {\n  id int\n}', positions: {}, ydoc: new Uint8Array([0]) });
  });

  afterEach(() => app.close());

  it('shows the owner\'s diagram to a viewer', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const { body } = await as('u2', 'get', `?spaceId=${space}`).expect(200);
    expect(body.dbml).toContain('Table a');
  });

  it('has no save route: diagrams change only through the live connection', async () => {
    await as('u1', 'put', '', { spaceId: space, dbml: 'Table c {\n  id int\n}', positions: {}, version: 1 }).expect(404);
  });

  it.each(allLabels)('answers 404 to u3 on %s and changes nothing', async (label) => {
    const [, method, url, body] = labelled(label);
    const before = await snapshot();
    await as('u3', method, url, body).expect(404);
    expect(await snapshot()).toBe(before);
  });

  it.each(writeLabels)('answers 403 to a viewer on %s and changes nothing', async (label) => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const [, method, url, body] = labelled(label);
    const before = await snapshot();
    await as('u2', method, url, body).expect(403);
    expect(await snapshot()).toBe(before);
  });

  it.each(writeLabels)('lets an editor use %s', async (label) => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const [, method, url, body] = labelled(label);
    const response = await as('u2', method, url, body);
    expect([200, 201]).toContain(response.status);
    expect((await db.select().from(diagrams)).map((d) => d.userId)).toEqual(['u1']);
  });
});
