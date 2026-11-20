import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { notebookPages, notebookPageVersions } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { NotebookController } from './notebook-controller.ts';
import { NotebookService } from './notebook-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const snapshot = async (db: Db) => ({
  pages: await db.select().from(notebookPages).orderBy(notebookPages.id),
  versions: await db.select().from(notebookPageVersions).orderBy(notebookPageVersions.id),
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

describe('notebook API sharing', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;
  const pageId = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
  const versionId = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c12';
  const newId = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c20';
  const as = (user: string, method: Method, path: string) =>
    request(app.getHttpServer())[method](`/api/notebook-pages${path}`).set('x-test-user', user);
  const fill = <T>(value: T): T => JSON.parse(JSON.stringify(value).replaceAll('SPACE', spaceId));

  beforeEach(async () => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
    db = await createTestDb();
    for (const id of ['u1', 'u2', 'u3']) await insertUser(db, id);
    spaceId = await insertSpace(db, 'u1', { tool: 'notebook' });
    await db.insert(notebookPages).values({ id: pageId, userId: 'u1', spaceId, content: doc('old'), position: 0 });
    await db.insert(notebookPageVersions).values({ id: versionId, pageId, userId: 'u1', content: doc('older'), createdAt: new Date(Date.now() - 3600_000) });
    const moduleRef = await Test.createTestingModule({
      controllers: [NotebookController],
      providers: [
        NotebookService,
        SpaceAccessService,
        SpaceLockService,
        BudgetAiService,
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

  it('lets an editor save content, keeping the version under the owner', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const { body } = await as('u2', 'patch', `/${pageId}`).send({ content: doc('new'), version: 0 }).expect(200);
    expect(body).toEqual({ version: 1 });
    const [page] = await db.select().from(notebookPages);
    expect(page).toMatchObject({ userId: 'u1', content: doc('new') });
    const versions = await db.select().from(notebookPageVersions);
    expect(versions).toHaveLength(2);
    expect(versions.every((v) => v.userId === 'u1')).toBe(true);
  });

  it('answers 409 to a content save from an old version and 400 to one with no version, changing nothing', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    await as('u1', 'patch', `/${pageId}`).send({ content: doc('owner'), version: 0 }).expect(200);
    const before = await snapshot(db);
    const { body } = await as('u2', 'patch', `/${pageId}`).send({ content: doc('stale'), version: 0 }).expect(409);
    expect(body.message).toBe('Changed by someone else');
    await as('u2', 'patch', `/${pageId}`).send({ content: doc('unversioned') }).expect(400);
    expect(await snapshot(db)).toEqual(before);
    await as('u2', 'patch', `/${pageId}`).send({ title: 'Renamed' }).expect(200);
  });

  it('lets a viewer read the versions but not checkpoint them', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const { body } = await as('u2', 'get', `/${pageId}/versions`).expect(200);
    expect(body).toHaveLength(1);
    await as('u2', 'get', `/${pageId}/versions/${versionId}`).expect(200);
    const before = await snapshot(db);
    await as('u2', 'post', `/${pageId}/versions`).expect(403);
    expect(await snapshot(db)).toEqual(before);
  });

  it('refuses a viewer on AI improve', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await as('u2', 'post', '/ai/improve').send({ spaceId, text: 'x', instruction: 'y' }).expect(403);
  });

  it('refuses a viewer on AI skill improve', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await as('u2', 'post', '/ai/skill').send({ spaceId, skill: { name: 'x', description: '', body: '' } }).expect(403);
  });

  it('keeps skills in Skills spaces and documents everywhere else', async () => {
    const skill = { type: 'skill', description: 'Use when deploying.', body: '# Deploy' };
    await as('u1', 'patch', `/${pageId}`).send({ content: skill, version: 0 }).expect(400);

    const skillsSpace = await insertSpace(db, 'u1', { tool: 'skills' });
    await as('u1', 'post', '').send({ id: newId, spaceId: skillsSpace }).expect(201);
    await as('u1', 'patch', `/${newId}`).send({ content: doc('x'), version: 0 }).expect(400);
    await as('u1', 'patch', `/${newId}`).send({ title: 'deploy-checklist', content: skill, version: 0 }).expect(200);
    const { body } = await as('u1', 'get', `?spaceId=${skillsSpace}`).expect(200);
    expect(body).toMatchObject([{ id: newId, title: 'deploy-checklist', content: skill, version: 1 }]);
  });

  it('creates an uploaded skill with its files in one request, refusing paths outside its folder', async () => {
    const skillsSpace = await insertSpace(db, 'u1', { tool: 'skills' });
    const skill = (path: string) => ({
      type: 'skill',
      description: 'Use when setting up Jenkins.',
      body: 'Copy `templates/Jenkinsfile`.',
      frontmatter: 'allowed-tools: Read, Write',
      files: [{ path, content: 'pipeline {}' }],
    });
    for (const path of ['../evil', '/etc/passwd', 'a\\b', 'SKILL.md', 'a//b']) {
      await as('u1', 'post', '').send({ id: newId, spaceId: skillsSpace, title: 'x', content: skill(path) }).expect(400);
    }
    await as('u1', 'post', '').send({ id: newId, spaceId, title: 'x', content: skill('templates/Jenkinsfile') }).expect(400);
    await as('u1', 'post', '').send({ id: newId, spaceId: skillsSpace, title: 'jenkinsfile-setup', content: skill('templates/Jenkinsfile') }).expect(201);
    const { body } = await as('u1', 'get', `?spaceId=${skillsSpace}`).expect(200);
    expect(body).toMatchObject([{ title: 'jenkinsfile-setup', content: skill('templates/Jenkinsfile'), version: 0 }]);
  });

  it('only returns a version that belongs to the page', async () => {
    const other = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c13';
    await db.insert(notebookPages).values({ id: other, userId: 'u1', spaceId, position: 1 });
    await as('u1', 'get', `/${other}/versions/${versionId}`).expect(404);
  });

  it('hides the history of a trashed page from a viewer', async () => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await db.update(notebookPages).set({ deletedAt: new Date() });
    await as('u2', 'get', `/${pageId}/versions`).expect(404);
    await as('u2', 'get', `/${pageId}/versions/${versionId}`).expect(404);
  });

  it.each([
    ['GET list', 'get', '?spaceId=SPACE', undefined],
    ['POST create', 'post', '', { id: newId, spaceId: 'SPACE' }],
    ['POST ai/improve', 'post', '/ai/improve', { spaceId: 'SPACE', text: 'x', instruction: 'y' }],
    ['POST ai/skill', 'post', '/ai/skill', { spaceId: 'SPACE', skill: { name: 'x', description: '', body: '' } }],
    ['PUT order', 'put', '/order', { spaceId: 'SPACE', ids: [pageId] }],
    ['GET versions', 'get', `/${pageId}/versions`, undefined],
    ['GET version', 'get', `/${pageId}/versions/${versionId}`, undefined],
    ['POST checkpoint', 'post', `/${pageId}/versions`, undefined],
    ['PATCH', 'patch', `/${pageId}`, { title: 'hacked' }],
    ['DELETE', 'delete', `/${pageId}`, undefined],
  ] as [string, Method, string, object | undefined][])(
    'answers 404 to a stranger on %s, changing nothing',
    async (_, method, path, body) => {
      const before = await snapshot(db);
      await as('u3', method, fill(path)).send(body && fill(body)).expect(404);
      expect(await snapshot(db)).toEqual(before);
    },
  );

  it.each([
    ['create', 'post', '', { id: newId, spaceId: 'SPACE' }],
    ['reorder', 'put', '/order', { spaceId: 'SPACE', ids: [pageId] }],
    ['checkpoint', 'post', `/${pageId}/versions`, undefined],
    ['rename', 'patch', `/${pageId}`, { title: 'Renamed' }],
    ['delete', 'delete', `/${pageId}`, undefined],
  ] as [string, Method, string, object | undefined][])('lets an editor %s, stored under the owner', async (_, method, path, body) => {
    await insertShare(db, { spaceId, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const res = await as('u2', method, path).send(body && fill(body));
    expect(res.status).toBeLessThan(300);
    expect((await db.select().from(notebookPages)).every((r) => r.userId === 'u1')).toBe(true);
    expect((await db.select().from(notebookPageVersions)).every((v) => v.userId === 'u1')).toBe(true);
  });
});
