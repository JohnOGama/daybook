import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import {
  fitnessExercises,
  fitnessFoodLogs,
  fitnessFoods,
  fitnessFoodServings,
  fitnessMealPlans,
  fitnessProfiles,
  fitnessWeights,
  fitnessWorkouts,
  fitnessWorkoutTemplates,
  spaces,
} from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { FitnessController } from './fitness-controller.ts';
import { FitnessFoodService } from './fitness-food-service.ts';
import { FitnessService } from './fitness-service.ts';
import { FitnessWorkoutService } from './fitness-workout-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};
const id = () => crypto.randomUUID();
const nutrition = { kcal: 100, proteinMg: 1000, carbsMg: 2000, fatMg: 3000, fiberMg: 400 };
const foodFields = { name: 'Oats', ...nutrition };
const item = { foodId: null, name: 'Oats', quantityMilli: 1000, servingLabel: '100 g', amountMg: 100_000, ...nutrition };
const workoutItem = { exerciseId: null, name: 'Squat', kind: 'weight', primary: ['quads'], secondary: [], sets: [] };
const exerciseFields = { name: 'Row', kind: 'weight', equipment: null, primary: ['lats'], secondary: [] };
const profile = {
  sex: 'male',
  birthDate: null,
  heightMm: null,
  activity: 'moderate',
  goal: 'maintain',
  goalWeightG: null,
  paceGPerWeek: 500,
  macros: { method: 'preset', preset: 'balanced' },
  forecast: { horizonDays: 90, kcalPerKg: 7700, trendDays: 14, energy: 'formula' },
};

describe('fitness API sharing', () => {
  let app: INestApplication;
  let db: Db;
  let space: string;
  let privateSpace: string;
  let builtInFood: string;
  let food: string;
  let serving: string;
  let log: string;
  let plan: string;
  let exercise: string;
  let template: string;
  let workout: string;

  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  const as = (user: string, method: Method, url: string, body?: object) => {
    const req = request(app.getHttpServer())[method](`/api/fitness${url}`).set('x-test-user', user);
    return body ? req.send(body) : req;
  };
  const snapshot = async () =>
    JSON.stringify([
      await db.select().from(fitnessProfiles),
      await db.select().from(fitnessFoods),
      await db.select().from(fitnessFoodServings),
      await db.select().from(fitnessFoodLogs),
      await db.select().from(fitnessMealPlans),
      await db.select().from(fitnessWeights),
      await db.select().from(fitnessExercises),
      await db.select().from(fitnessWorkoutTemplates),
      await db.select().from(fitnessWorkouts),
    ]);

  // Every route, with a minimal valid request. It must match the controller's decorators.
  const routes = (): [string, Method, string, object?][] => [
    ['GET /', 'get', `?spaceId=${space}`],
    ['PUT profile', 'put', '/profile', { spaceId: space, ...profile }],
    ['GET foods', 'get', `/foods?spaceId=${space}&q=oats`],
    ['GET foods/mine', 'get', `/foods/mine?spaceId=${space}`],
    ['GET foods/recent', 'get', `/foods/recent?spaceId=${space}`],
    ['POST foods', 'post', '/foods', { id: id(), spaceId: space, ...foodFields, servings: [] }],
    ['PATCH foods/:id', 'patch', `/foods/${food}`, { ...foodFields, name: 'Changed' }],
    ['DELETE foods/:id', 'delete', `/foods/${food}`],
    ['POST foods/:id/servings (own)', 'post', `/foods/${food}/servings`, { id: id(), spaceId: space, label: 'cup', amountMg: 50_000 }],
    ['POST foods/:id/servings (built-in)', 'post', `/foods/${builtInFood}/servings`, { id: id(), spaceId: space, label: 'cup', amountMg: 50_000 }],
    ['DELETE servings/:id', 'delete', `/servings/${serving}`],
    ['GET days', 'get', `/days?spaceId=${space}&from=2026-11-09&to=2026-11-09`],
    ['POST logs', 'post', '/logs', { spaceId: space, logs: [{ id: id(), day: '2026-11-09', meal: 'lunch', eaten: true, ...item }] }],
    ['PATCH logs/:id', 'patch', `/logs/${log}`, { eaten: false }],
    ['DELETE logs/:id', 'delete', `/logs/${log}`],
    ['PUT weights', 'put', '/weights', { spaceId: space, day: '2026-11-10', weightG: 80_000 }],
    ['DELETE weights', 'delete', `/weights?spaceId=${space}&day=2026-11-09`],
    ['POST meal-plans', 'post', '/meal-plans', { id: id(), spaceId: space, name: 'Plan', items: [{ meal: 'lunch', ...item }] }],
    ['PUT meal-plans/:id', 'put', `/meal-plans/${plan}`, { name: 'Renamed', items: [{ meal: 'lunch', ...item }], version: 0 }],
    ['DELETE meal-plans/:id', 'delete', `/meal-plans/${plan}`],
    ['GET exercises', 'get', `/exercises?spaceId=${space}`],
    ['POST exercises', 'post', '/exercises', { id: id(), spaceId: space, ...exerciseFields }],
    ['PATCH exercises/:id', 'patch', `/exercises/${exercise}`, { ...exerciseFields, name: 'Changed' }],
    ['DELETE exercises/:id', 'delete', `/exercises/${exercise}`],
    ['POST templates', 'post', '/templates', { id: id(), spaceId: space, name: 'Push', items: [workoutItem] }],
    ['PUT templates/:id', 'put', `/templates/${template}`, { name: 'Renamed', items: [workoutItem], version: 0 }],
    ['DELETE templates/:id', 'delete', `/templates/${template}`],
    ['POST workouts', 'post', '/workouts', { id: id(), spaceId: space, day: '2026-11-09', name: 'Legs', items: [] }],
    ['PUT workouts/:id', 'put', `/workouts/${workout}`, { day: '2026-11-09', name: 'Renamed', items: [], version: 0 }],
    ['DELETE workouts/:id', 'delete', `/workouts/${workout}`],
    ['POST ai/read', 'post', '/ai/read', { spaceId: space, summary: { weeks: 1 } }],
  ];
  const labelled = (label: string) => routes().find(([name]) => name === label) as [string, Method, string, object?];
  const allLabels = routes().map(([label]) => label);
  const writeLabels = routes().filter(([, method]) => method !== 'get').map(([label]) => label);

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    const moduleRef = await Test.createTestingModule({
      controllers: [FitnessController],
      providers: [
        FitnessService,
        FitnessFoodService,
        FitnessWorkoutService,
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

    space = await insertSpace(db, 'u1', { tool: 'fitness' });
    privateSpace = await insertSpace(db, 'u1', { tool: 'fitness' });
    [{ id: builtInFood }] = await db.insert(fitnessFoods).values({ name: 'Built-in oats', ...nutrition }).returning({ id: fitnessFoods.id });

    food = id();
    serving = id();
    log = id();
    plan = id();
    exercise = id();
    template = id();
    workout = id();
    await as('u1', 'post', '/foods', { id: food, spaceId: space, ...foodFields, servings: [{ id: serving, label: 'bowl', amountMg: 40_000 }] }).expect(201);
    await as('u1', 'post', '/logs', { spaceId: space, logs: [{ id: log, day: '2026-11-09', meal: 'lunch', eaten: true, ...item, foodId: food }] }).expect(201);
    await as('u1', 'put', '/weights', { spaceId: space, day: '2026-11-09', weightG: 80_000 }).expect(200);
    await as('u1', 'post', '/meal-plans', { id: plan, spaceId: space, name: 'Plan', items: [{ meal: 'lunch', ...item }] }).expect(201);
    await as('u1', 'post', '/exercises', { id: exercise, spaceId: space, ...exerciseFields }).expect(201);
    await as('u1', 'post', '/templates', { id: template, spaceId: space, name: 'Push', items: [workoutItem] }).expect(201);
    await as('u1', 'post', '/workouts', { id: workout, spaceId: space, day: '2026-11-09', name: 'Legs', items: [] }).expect(201);
  });

  afterEach(() => app.close());

  it('lets an editor log a food under the owner', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const entry = id();
    await as('u2', 'post', '/logs', { spaceId: space, logs: [{ id: entry, day: '2026-11-09', meal: 'lunch', eaten: true, ...item }] }).expect(201);
    const [row] = (await db.select().from(fitnessFoodLogs)).filter((l) => l.id === entry);
    expect(row).toMatchObject({ userId: 'u1', spaceId: space });
  });

  it('shows the owner\'s days to a viewer', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const { body } = await as('u2', 'get', `/days?spaceId=${space}&from=2026-11-09&to=2026-11-09`).expect(200);
    expect(body.logs.map((l: { id: string }) => l.id)).toEqual([log]);
  });

  it('keeps built-in foods readable through a shared space', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const { body } = await as('u2', 'get', `/foods?spaceId=${space}&q=built-in`).expect(200);
    expect(body.map((f: { id: string }) => f.id)).toEqual([builtInFood]);
  });

  it.each([['PATCH', 'patch'], ['DELETE', 'delete']] as const)('answers 404 to %s on a built-in food, even for the owner', async (_, method) => {
    const before = await snapshot();
    await as('u1', method, `/foods/${builtInFood}`, method === 'patch' ? foodFields : undefined).expect(404);
    expect(await snapshot()).toBe(before);
  });

  it('answers 404 when a built-in food gets a serving for a space the user cannot see', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const before = await snapshot();
    await as('u2', 'post', `/foods/${builtInFood}/servings`, { id: id(), spaceId: privateSpace, label: 'cup', amountMg: 50_000 }).expect(404);
    expect(await snapshot()).toBe(before);
  });

  it('answers 404 when an editor deletes a built-in serving', async () => {
    const [builtIn] = await db.insert(fitnessFoodServings).values({ foodId: builtInFood, label: 'cup', amountMg: 1000 }).returning();
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const before = await snapshot();
    await as('u2', 'delete', `/servings/${builtIn.id}`).expect(404);
    expect(await snapshot()).toBe(before);
  });

  it('lets an editor add a serving to a built-in food in the shared space', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const added = id();
    await as('u2', 'post', `/foods/${builtInFood}/servings`, { id: added, spaceId: space, label: 'cup', amountMg: 50_000 }).expect(201);
    const [row] = (await db.select().from(fitnessFoodServings)).filter((s) => s.id === added);
    expect(row).toMatchObject({ userId: 'u1', spaceId: space });
  });

  it('answers 404 on a trashed space for a viewer', async () => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, space));
    await as('u2', 'get', `?spaceId=${space}`).expect(404);
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

  it.each([
    ['PUT profile', 'put', '/profile'],
    ['POST foods', 'post', '/foods'],
    ['POST logs', 'post', '/logs'],
    ['PUT weights', 'put', '/weights'],
    ['POST meal-plans', 'post', '/meal-plans'],
    ['POST exercises', 'post', '/exercises'],
    ['POST templates', 'post', '/templates'],
    ['POST workouts', 'post', '/workouts'],
  ] as const)('stores %s from an editor under the owner', async (name, method, url) => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const [, , , body] = labelled(name);
    await as('u2', method, url, body).expect(method === 'put' ? 200 : 201);
    const owners = [
      ...(await db.select().from(fitnessProfiles)),
      ...(await db.select().from(fitnessFoods)).filter((r) => r.spaceId),
      ...(await db.select().from(fitnessFoodLogs)),
      ...(await db.select().from(fitnessWeights)),
      ...(await db.select().from(fitnessMealPlans)),
      ...(await db.select().from(fitnessExercises)).filter((r) => r.spaceId),
      ...(await db.select().from(fitnessWorkoutTemplates)),
      ...(await db.select().from(fitnessWorkouts)),
    ].map((r) => r.userId);
    expect(new Set(owners)).toEqual(new Set(['u1']));
  });

  it.each([
    'PATCH foods/:id',
    'DELETE foods/:id',
    'DELETE servings/:id',
    'PATCH logs/:id',
    'DELETE logs/:id',
    'PUT meal-plans/:id',
    'DELETE meal-plans/:id',
    'PATCH exercises/:id',
    'DELETE exercises/:id',
    'PUT templates/:id',
    'DELETE templates/:id',
    'PUT workouts/:id',
    'DELETE workouts/:id',
    'DELETE weights',
    'POST ai/read',
  ] as const)('lets an editor use %s', async (name) => {
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const [, method, url, body] = labelled(name);
    const response = await as('u2', method, url, body);
    // ai/read answers 503 when no Gemini key is set; everything else must succeed.
    expect(name === 'POST ai/read' ? [200, 201, 503] : [200, 201, 204]).toContain(response.status);
  });
});
