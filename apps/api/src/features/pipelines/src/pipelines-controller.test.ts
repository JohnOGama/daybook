import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { pipelineKeys, pipelineRuns, spaces, spaceShares } from '../../../shared/db/schema.ts';
import { createTestDb, insertFolder, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { PipelineKeysService } from './pipeline-keys-service.ts';
import { PIPELINES_NOTIFIER } from './pipelines-notifier.ts';
import { PipelinesController } from './pipelines-controller.ts';
import { PipelinesService } from './pipelines-service.ts';
import { REPORT_PATH, ReportController, reportBodyParser } from './report-controller.ts';
import { ReportLimiter } from './report-limiter.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

describe('pipelines API', () => {
  let app: INestApplication;
  let db: Db;
  let space: string;
  let key: string;
  let clock: number;
  const changed: string[] = [];
  // The real AI service with Gemini faked: each call answers with the next reply.
  const replies: string[] = [];
  const generateContent = vi.fn(async (_request: unknown) => ({ text: replies.shift() }));
  const ai = Object.assign(new BudgetAiService(), { client: { models: { generateContent } } });

  const report = (body: object, bearer: string | null = key) => {
    const req = request(app.getHttpServer()).post('/api/pipelines/report');
    return (bearer === null ? req : req.set('Authorization', `Bearer ${bearer}`)).send(body);
  };
  const as = (user: string, method: 'get' | 'post', url: string) => request(app.getHttpServer())[method](`/api/pipelines${url}`).set('x-test-user', user);

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
  });

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    changed.length = 0;
    clock = 1_000_000;
    const moduleRef = await Test.createTestingModule({
      controllers: [PipelinesController, ReportController],
      providers: [
        PipelinesService,
        PipelineKeysService,
        SpaceAccessService,
        SpaceLockService,
        AuthGuard,
        { provide: ReportLimiter, useValue: Object.assign(new ReportLimiter(), { now: () => clock }) },
        { provide: PIPELINES_NOTIFIER, useValue: { changed: async (id: string) => void changed.push(id) } },
        { provide: BudgetAiService, useValue: ai },
        { provide: DB, useValue: db },
        { provide: AUTH, useValue: fakeAuth },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(REPORT_PATH, reportBodyParser());
    app.use(express.json());
    app.setGlobalPrefix('api');
    await app.init();
    space = await insertSpace(db, 'u1', { tool: 'pipelines' });
    key = await app.get(PipelineKeysService).create(space);
  });

  afterEach(() => app.close());

  it('reports with a valid key are stored under the owner, answer 202 and notify', async () => {
    const res = await report({ job: 'api', run: '1', stage: 'Build', status: 'started' }).expect(202);
    expect(res.text).toBe('');
    const [run] = await db.select().from(pipelineRuns);
    expect(run).toMatchObject({ spaceId: space, userId: 'u1', job: 'api', number: 1 });
    expect(changed).toEqual([space]);
  });

  it('401 with no body detail for: no header, a wrong key, a replaced key, a trashed space, a non-pipelines space', async () => {
    const body = { job: 'api', run: 1, stage: 'Build', status: 'started' };
    const expect401 = async (bearer: string | null) => {
      const res = await report(body, bearer).expect(401);
      expect(JSON.stringify(res.body)).not.toMatch(/key|space|hash/i);
    };
    await expect401(null);
    await expect401('dbk_wrong');
    const old = key;
    key = await app.get(PipelineKeysService).create(space);
    await expect401(old);
    await report(body).expect(202);
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, space));
    await expect401(key);
    const list = await insertSpace(db, 'u1', { tool: 'list' });
    await expect401(await app.get(PipelineKeysService).create(list));
  });

  it('401 for a space inside a trashed folder, and reports work again once it is restored', async () => {
    const folder = await insertFolder(db, 'u1');
    await db.update(spaces).set({ parentId: folder }).where(eq(spaces.id, space));
    await report({ job: 'api', run: 1, status: 'passed' }).expect(202);
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, folder));
    await report({ job: 'api', run: 2, status: 'passed' }).expect(401);
    await db.update(spaces).set({ deletedAt: null }).where(eq(spaces.id, folder));
    await report({ job: 'api', run: 3, status: 'passed' }).expect(202);
  });

  it('400 names the field for a bad body', async () => {
    const res = await report({ job: 'api', run: 'abc', stage: 'Build', status: 'started' }).expect(400);
    expect(JSON.stringify(res.body)).toContain('run');
  });

  it('429 after 120 reports in a minute, and allowed again a minute later', async () => {
    for (let index = 0; index < 120; index++) await report({ job: 'api', run: 1, stage: `S${index % 40}`, status: 'started' }).expect(202);
    await report({ job: 'api', run: 1, stage: 'Build', status: 'started' }).expect(429);
    clock += 60_001;
    await report({ job: 'api', run: 1, stage: 'Build', status: 'started' }).expect(202);
  });

  it('a key writes only to its own space', async () => {
    const other = await insertSpace(db, 'u1', { tool: 'pipelines' });
    await app.get(PipelineKeysService).create(other);
    await report({ job: 'api', run: 5, stage: 'Build', status: 'started' }).expect(202);
    const runs = await db.select().from(pipelineRuns);
    expect(runs.map((r) => r.spaceId)).toEqual([space]);
  });

  it('only the owner can create or read the key; an editor and a stranger get 404', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    for (const user of ['u2', 'u3']) {
      await as(user, 'get', `/${space}/key`).expect(404);
      await as(user, 'post', `/${space}/key`).expect(404);
    }
  });

  it('the key is shown once: GET returns only dates, the stored hash is not the key, and a new key retires the old one', async () => {
    await report({ job: 'api', run: 1, status: 'passed' }).expect(202);
    const { body } = await as('u1', 'get', `/${space}/key`).expect(200);
    expect(Object.keys(body).sort()).toEqual(['createdAt', 'lastUsedAt']);
    expect(body.lastUsedAt).toEqual(expect.any(String));
    const [row] = await db.select().from(pipelineKeys);
    expect(row.keyHash).not.toContain(key);
    expect(row.keyHash).toMatch(/^[0-9a-f]{64}$/);
    const fresh = (await as('u1', 'post', `/${space}/key`).expect(201)).body.key;
    expect(fresh).toMatch(/^dbk_[A-Za-z0-9_-]{32}$/);
    await report({ job: 'api', run: 2, status: 'passed' }).expect(401);
    await report({ job: 'api', run: 2, status: 'passed' }, fresh).expect(202);
  });

  it('a viewer can read the pipelines and a run; a stranger gets 404; a locked space needs the unlock cookie', async () => {
    await report({ job: 'api', run: 1, stage: 'Build', status: 'started' }).expect(202);
    const [run] = await db.select().from(pipelineRuns);
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const view = (await as('u2', 'get', `?spaceId=${space}`).expect(200)).body;
    expect(view.jobs[0].latest.stages[0].name).toBe('Build');
    expect((await as('u2', 'get', `/runs/${run.id}`).expect(200)).body.number).toBe(1);
    await as('u3', 'get', `?spaceId=${space}`).expect(404);
    await as('u3', 'get', `/runs/${run.id}`).expect(404);

    const token = await app.get(SpaceLockService).setPassword('u1', space, 'hunter22');
    await as('u1', 'get', `?spaceId=${space}`).expect(403);
    await as('u1', 'get', `/runs/${run.id}`).expect(403);
    await as('u1', 'get', `?spaceId=${space}`).set('Cookie', `daybook_unlock_${space}=${token}`).expect(200);
    // Reporting is not affected by the space password.
    await report({ job: 'api', run: 1, stage: 'Build', status: 'passed' }).expect(202);
  });

  it('GET /pipelines answers 404 for a space of another tool', async () => {
    const list = await insertSpace(db, 'u1', { tool: 'list' });
    await as('u1', 'get', `?spaceId=${list}`).expect(404);
  });

  describe('AI: add Daybook reporting', () => {
    const JENKINSFILE = "pipeline {\n  agent any\n  stages {\n    stage('Test') {\n      steps {\n        sh 'pnpm test'\n      }\n    }\n  }\n}";
    const instrumented = (text: string) =>
      JSON.stringify({ lines: ["def daybook(String stage, String status, String message = '') { }", ...text.split('\n').flatMap((line) => (line.trim() === 'agent any' ? [line, "  environment { DAYBOOK_KEY = credentials('DAYBOOK_KEY') }"] : [line]))], summary: 'Added reporting to 1 stage.' });
    const instrument = (user: string) => as(user, 'post', '/ai/instrument').send({ spaceId: space, jenkinsfile: JENKINSFILE });

    beforeEach(() => {
      replies.length = 0;
      generateContent.mockClear();
      process.env.BETTER_AUTH_URL = 'https://daybook.example.com';
    });

    it('a viewer gets 403; an editor gets the file with reporting added', async () => {
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
      await instrument('u2').expect(403);
      await db.delete(spaceShares);
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
      replies.push(instrumented(JENKINSFILE));
      const { body } = await instrument('u2').expect(201);
      expect(body.jenkinsfile).toContain("credentials('DAYBOOK_KEY')");
      expect(body.jenkinsfile).toContain("sh 'pnpm test'");
      expect(body.summary).toBe('Added reporting to 1 stage.');
    });

    it("the prompt holds the file and Daybook's address, never the space's key", async () => {
      replies.push(instrumented(JENKINSFILE));
      await instrument('u1').expect(201);
      const sent = JSON.stringify(generateContent.mock.calls);
      expect(sent).toContain('pnpm test');
      expect(sent).toContain('https://daybook.example.com');
      expect(sent).not.toContain(key);
    });

    it('the helper it asks for writes one file per stage and can never fail the build', async () => {
      replies.push(instrumented(JENKINSFILE));
      await instrument('u1').expect(201);
      const prompt = String((generateContent.mock.calls[0][0] as { config: { systemInstruction: string } }).config.systemInstruction);
      expect(prompt).toContain(".daybook-${stage.replaceAll('[^A-Za-z0-9_-]', '_')}.json");
      expect(prompt).toContain('.daybook-run.json');
      expect(prompt.match(/catch \(e\)/g)).toHaveLength(2);
      expect(prompt).toContain('echo "Daybook report skipped: ${e}"');
    });

    it("refuses after two answers that change existing steps, with the spec's message", async () => {
      replies.push(instrumented(JENKINSFILE.replace('pnpm test', 'pnpm test --bail')), instrumented(JENKINSFILE.replace('pnpm test', 'rm -rf /')));
      const res = await instrument('u1').expect(502);
      expect(res.body.message).toBe(
        "The AI changed your existing steps, so nothing was added. Try again, or add the lines by hand. (It changed or removed this line: sh 'pnpm test')",
      );
      expect(generateContent).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(generateContent.mock.calls[1])).toContain('changed or removed this line');
    });

    it('a stranger gets 404', async () => {
      await instrument('u3').expect(404);
    });
  });

  it('the report route accepts 64 KB and refuses more', async () => {
    const big = (size: number) => ({ job: 'api', run: 1, stage: 'Test', status: 'failed', error: 'x'.repeat(size) });
    await report(big(60_000)).expect(202);
    await report(big(70_000)).expect(413);
  });
});
