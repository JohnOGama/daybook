import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { jobProfiles, jobs } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { JobsController } from './jobs-controller.ts';
import { JobsService } from './jobs-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};
const fakeAi = {
  enabled: true,
  readPosting: async () => null,
  matchJob: async () => ({ pct: 80, summary: 'Good', skillsHave: [], skillsMissing: [] }),
};
const id = () => crypto.randomUUID();
const fields = {
  role: 'Dev',
  company: 'Acme',
  url: null,
  location: null,
  workMode: null,
  salary: null,
  employmentType: null,
  postedOn: null,
  description: 'Build things',
  notes: '',
  status: 'saved',
  events: [],
  nextStepDay: null,
  nextStepNote: null,
};

describe('jobs API sharing', () => {
  let app: INestApplication;
  let db: Db;
  let space: string;
  let job: string;

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const as = (user: string, method: Method, url: string, body?: object) => {
    const req = request(app.getHttpServer())[method](`/api/jobs${url}`).set('x-test-user', user);
    return body ? req.send(body) : req;
  };
  const snapshot = async () => JSON.stringify([await db.select().from(jobs), await db.select().from(jobProfiles)]);

  // Every route, with a minimal valid request. It must match the controller's decorators.
  // The posting URL is a loopback address, so the page read is refused before any network call.
  const routes = (): [string, Method, string, object?][] => [
    ['GET /', 'get', `?spaceId=${space}`],
    ['PUT profile', 'put', '/profile', { spaceId: space, cvText: 'My CV' }],
    ['POST /', 'post', '', { id: id(), spaceId: space, ...fields }],
    ['POST ai/read-posting', 'post', '/ai/read-posting', { spaceId: space, url: 'http://127.0.0.1/job' }],
    ['POST :id/match', 'post', `/${job}/match`],
    ['PATCH :id', 'patch', `/${job}`, { notes: 'Changed' }],
    ['DELETE :id', 'delete', `/${job}`],
  ];
  const labelled = (label: string) => routes().find(([name]) => name === label) as [string, Method, string, object?];
  const allLabels = routes().map(([label]) => label);
  const writeLabels = routes().filter(([, method]) => method !== 'get').map(([label]) => label);

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    const moduleRef = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        JobsService,
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

    space = await insertSpace(db, 'u1', { tool: 'jobs' });
    job = id();
    await as('u1', 'put', '/profile', { spaceId: space, cvText: 'My CV' }).expect(200);
    await as('u1', 'post', '', { id: job, spaceId: space, ...fields }).expect(201);
  });

  afterEach(() => app.close());

  it('changes only the fields sent, so a status change keeps the description, notes and interview time', async () => {
    await as('u1', 'patch', `/${job}`, { notes: 'Ask about the team', nextStepAt: '2026-11-19T09:30:00.000Z' }).expect(200);
    await as('u1', 'patch', `/${job}`, { status: 'applied', events: [{ kind: 'status', status: 'applied', day: '2026-11-14' }] }).expect(200);
    const [row] = await db.select().from(jobs);
    expect(row).toMatchObject({ description: 'Build things', notes: 'Ask about the team', status: 'applied' });
    expect(new Date(row.nextStepAt as string).toISOString()).toBe('2026-11-19T09:30:00.000Z');
    const { body } = await as('u1', 'get', `?spaceId=${space}`).expect(200);
    expect(body.jobs[0]).toMatchObject({ nextStepAt: '2026-11-19T09:30:00.000Z' });
    expect(body.jobs[0]).not.toHaveProperty('reminderSentFor');
  });

  it('shows the owner\'s jobs to a viewer', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const { body } = await as('u2', 'get', `?spaceId=${space}`).expect(200);
    expect(body.jobs.map((j: { id: string }) => j.id)).toEqual([job]);
  });

  it('creates an editor\'s job under the owner', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const added = id();
    await as('u2', 'post', '', { id: added, spaceId: space, ...fields }).expect(201);
    const [row] = (await db.select().from(jobs)).filter((j) => j.id === added);
    expect(row).toMatchObject({ userId: 'u1', spaceId: space });
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
    // read-posting refuses the loopback link with 400, after access passed and before any network call.
    expect(label === 'POST ai/read-posting' ? [400] : [200, 201, 204]).toContain(response.status);
    for (const { userId } of await db.select().from(jobs)) expect(userId).toBe('u1');
    expect((await db.select().from(jobProfiles)).map((p) => p.userId)).toEqual(['u1']);
  });
});
