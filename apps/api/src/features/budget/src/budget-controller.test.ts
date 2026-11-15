import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import {
  budgetAccounts,
  budgetCategories,
  budgetEntries,
  budgetGoalContributions,
  budgetGoals,
  budgetReceipts,
  budgets,
  budgetSchedules,
} from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { BudgetAiService } from './budget-ai-service.ts';
import { BudgetController } from './budget-controller.ts';
import { BudgetService } from './budget-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};
const id = () => crypto.randomUUID();
const PIXEL = 'iVBORw0KGgo=';

describe('budget API sharing', () => {
  let app: INestApplication;
  let db: Db;
  let space: string;
  let otherSpace: string;
  let account: string;
  let otherAccount: string;
  let category: string;
  let entry: string;
  let schedule: string;
  let goal: string;
  let contribution: string;

  const as = (user: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: object) => {
    const req = request(app.getHttpServer())[method](`/api/budget${url}`).set('x-test-user', user);
    return body ? req.send(body) : req;
  };
  const snapshot = async () =>
    JSON.stringify([
      await db.select().from(budgets),
      await db.select().from(budgetAccounts),
      await db.select().from(budgetCategories),
      await db.select().from(budgetEntries),
      await db.select().from(budgetSchedules),
      await db.select().from(budgetGoals),
      await db.select().from(budgetGoalContributions),
      await db.select().from(budgetReceipts),
    ]);
  const flow = (extra: object = {}) => ({ kind: 'expense', amount: 500, accountId: account, categoryId: category, day: '2026-11-09', ...extra });
  const scheduleShape = () => ({
    ...flow(),
    name: 'Rent',
    frequency: 'monthly',
    interval: 1,
    monthDays: [1],
    startDay: '2026-11-01',
    endDay: null,
    activeFrom: '2026-11-01',
    pausedFrom: null,
    skippedDays: [],
    autoRecord: false,
    isSubscription: false,
  });

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    const moduleRef = await Test.createTestingModule({
      controllers: [BudgetController],
      providers: [
        BudgetService,
        BudgetAiService,
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

    space = await insertSpace(db, 'u1', { tool: 'budget' });
    otherSpace = await insertSpace(db, 'u1', { tool: 'budget' });
    const loaded = (await as('u1', 'get', `?spaceId=${space}`).expect(200)).body;
    account = loaded.accounts[0].id;
    category = loaded.categories.find((c: { kind: string }) => c.kind === 'expense').id;
    otherAccount = (await as('u1', 'get', `?spaceId=${otherSpace}`).expect(200)).body.accounts[0].id;

    entry = id();
    await as('u1', 'post', '/entries', { id: entry, spaceId: space, ...flow() }).expect(201);
    await as('u1', 'put', `/receipts/${entry}`, { mediaType: 'image/png', data: PIXEL }).expect(200);
    schedule = id();
    await as('u1', 'post', '/schedules', { id: schedule, spaceId: space, ...scheduleShape() }).expect(201);
    goal = id();
    await as('u1', 'post', '/goals', { id: goal, spaceId: space, name: 'Trip', target: 1000, targetDay: null }).expect(201);
    contribution = id();
    await as('u1', 'post', '/contributions', { id: contribution, goalId: goal, amount: 100, day: '2026-11-09' }).expect(201);
  });

  afterEach(() => app.close());

  const routes = (): [string, string, string, object?][] => [
    ['get', 'load', `?spaceId=${space}`],
    ['put', 'settings', `/${space}`, { currency: 'EUR' }],
    ['post', 'account', '/accounts', { id: id(), spaceId: space, name: 'X', type: 'bank', openingBalance: 0 }],
    ['patch', 'account', `/accounts/${account}`, { name: 'Y' }],
    ['delete', 'account', `/accounts/${account}`],
    ['post', 'category', '/categories', { id: id(), spaceId: space, name: 'X', kind: 'expense' }],
    ['patch', 'category', `/categories/${category}`, { name: 'Y' }],
    ['delete', 'category', `/categories/${category}`],
    ['post', 'entry', '/entries', { id: id(), spaceId: space, ...flow() }],
    ['put', 'entry', `/entries/${entry}`, flow({ amount: 700 })],
    ['delete', 'entry', `/entries/${entry}`],
    ['post', 'schedule', '/schedules', { id: id(), spaceId: space, ...scheduleShape() }],
    ['put', 'schedule', `/schedules/${schedule}`, scheduleShape()],
    ['delete', 'schedule', `/schedules/${schedule}`],
    ['post', 'goal', '/goals', { id: id(), spaceId: space, name: 'G', target: 5, targetDay: null }],
    ['patch', 'goal', `/goals/${goal}`, { name: 'Z' }],
    ['delete', 'goal', `/goals/${goal}`],
    ['post', 'contribution', '/contributions', { id: id(), goalId: goal, amount: 5, day: '2026-11-09' }],
    ['delete', 'contribution', `/contributions/${contribution}`],
    ['put', 'receipt', `/receipts/${entry}`, { mediaType: 'image/png', data: PIXEL }],
    ['get', 'receipt', `/receipts/${entry}`],
    ['delete', 'receipt', `/receipts/${entry}`],
    ['post', 'categorize', '/ai/categorize', { spaceId: space, kind: 'expense', note: 'coffee', amount: '3' }],
    ['post', 'scan', '/ai/scan-receipt', { spaceId: space, today: '2026-11-09', mediaType: 'image/png', data: PIXEL }],
    ['post', 'insights', '/ai/insights', { spaceId: space, summary: {} }],
  ];

  it('answers 404 to everyone else on every route, changing nothing', async () => {
    const before = await snapshot();
    for (const [method, name, url, body] of routes()) {
      const res = await as('u3', method as 'get', url, body);
      expect(res.status, `${method} ${name}`).toBe(404);
    }
    expect(await snapshot()).toBe(before);
  });

  describe('with an edit share', () => {
    beforeEach(async () => {
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    });

    it('lets an editor read and keeps new entries under the owner', async () => {
      await as('u2', 'get', `?spaceId=${space}`).expect(200);
      const created = id();
      await as('u2', 'post', '/entries', { id: created, spaceId: space, ...flow() }).expect(201);
      const [row] = (await db.select().from(budgetEntries)).filter((e) => e.id === created);
      expect(row.userId).toBe('u1');
    });

    it.each([
      ['settings', 'put', (c: Ctx) => `/${c.space}`, (c: Ctx) => ({ currency: 'EUR' }), 200],
      ['account', 'post', () => '/accounts', (c: Ctx) => ({ id: id(), spaceId: c.space, name: 'X', type: 'bank', openingBalance: 0 }), 201],
      ['category', 'post', () => '/categories', (c: Ctx) => ({ id: id(), spaceId: c.space, name: 'X', kind: 'expense' }), 201],
      ['goal', 'post', () => '/goals', (c: Ctx) => ({ id: id(), spaceId: c.space, name: 'G', target: 5, targetDay: null }), 201],
      ['contribution', 'post', () => '/contributions', (c: Ctx) => ({ id: id(), goalId: c.goal, amount: 5, day: '2026-11-09' }), 201],
      ['entry update', 'put', (c: Ctx) => `/entries/${c.entry}`, (c: Ctx) => flow({ amount: 700, accountId: c.account, categoryId: c.category }), 200],
      ['receipt', 'put', (c: Ctx) => `/receipts/${c.entry}`, () => ({ mediaType: 'image/png', data: PIXEL }), 200],
      ['contribution delete', 'delete', (c: Ctx) => `/contributions/${c.contribution}`, () => undefined, 200],
      ['account delete', 'delete', (c: Ctx) => `/accounts/${c.account}`, () => undefined, 200],
    ] as const)('lets an editor change %s, stored under the owner', async (_, method, url, body, status) => {
      const ctx = { space, entry, account, category, goal, contribution };
      await as('u2', method, url(ctx), body(ctx)).expect(status);
      for (const table of [budgetAccounts, budgetCategories, budgetGoals, budgetGoalContributions, budgetEntries, budgetReceipts]) {
        expect((await db.select().from(table)).every((r) => r.userId === 'u1')).toBe(true);
      }
    });

    it('answers 404 for an entry using an account from the owner\'s unshared budget, creating nothing', async () => {
      const before = await snapshot();
      await as('u2', 'post', '/entries', { id: id(), spaceId: space, ...flow({ accountId: otherAccount }) }).expect(404);
      expect(await snapshot()).toBe(before);
    });

    it('answers 404 for a space the owner did not share', async () => {
      await as('u2', 'get', `?spaceId=${otherSpace}`).expect(404);
      await as('u2', 'post', '/goals', { id: id(), spaceId: otherSpace, name: 'G', target: 5, targetDay: null }).expect(404);
    });
  });

  describe('with a view share', () => {
    beforeEach(async () => {
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    });

    it('lets a viewer read the budget and a receipt', async () => {
      await as('u2', 'get', `?spaceId=${space}`).expect(200);
      await as('u2', 'get', `/receipts/${entry}`).expect(200);
    });

    it('answers 403 to a viewer on every write and AI route, changing nothing', async () => {
      const before = await snapshot();
      for (const [method, name, url, body] of routes().filter(([m, n]) => n !== 'load' && !(m === 'get' && n === 'receipt'))) {
        const res = await as('u2', method as 'get', url, body);
        expect(res.status, `${method} ${name}`).toBe(403);
      }
      expect(await snapshot()).toBe(before);
    });
  });
});

type Ctx = { space: string; entry: string; account: string; category: string; goal: string; contribution: string };
