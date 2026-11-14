import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { type NewJob, newJobSchema } from './jobs-schemas.ts';
import { JobsService } from './jobs-service.ts';

describe('JobsService', () => {
  let db: Db;
  let svc: JobsService;
  let space: string;
  let theirs: string;

  const addSpace = async (userId: string, tool: 'jobs' | 'budget' = 'jobs') => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Job hunt', tool }).returning();
    return row.id;
  };

  const job = (overrides: Partial<NewJob> = {}): NewJob =>
    newJobSchema.parse({
      id: crypto.randomUUID(),
      spaceId: space,
      role: 'Frontend Engineer',
      company: 'Acme',
      url: 'https://acme.example/jobs/1',
      location: null,
      workMode: 'remote',
      salary: null,
      employmentType: null,
      postedOn: null,
      status: 'saved',
      events: [],
      nextStepDay: null,
      nextStepNote: null,
      ...overrides,
    });

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new JobsService(db);
    space = await addSpace('u1');
    theirs = await addSpace('u2');
  });

  it('starts empty with no CV', async () => {
    expect(await svc.load('u1', space)).toEqual({ profile: { cvText: null, cvUpdatedAt: null }, jobs: [] });
  });

  it('creates jobs and lists them newest first, with defaults filled in', async () => {
    const first = job({ createdAt: '2026-11-10T10:00:00.000Z' });
    const second = job({ role: 'React Engineer', createdAt: '2026-11-12T10:00:00.000Z' });
    await svc.create('u1', first);
    await svc.create('u1', second);
    const { jobs } = await svc.load('u1', space);
    expect(jobs.map((row) => row.role)).toEqual(['React Engineer', 'Frontend Engineer']);
    expect(jobs[1]).toMatchObject({ id: first.id, description: '', notes: '', match: null, createdAt: '2026-11-10T10:00:00.000Z' });
  });

  it('restores a deleted job exactly, with its match (Undo)', async () => {
    const match = { pct: 82, summary: 'Strong fit.', skillsHave: ['React'], skillsMissing: ['GraphQL'], matchedAt: '2026-11-11T09:00:00.000Z' };
    const restored = job({ createdAt: '2026-11-10T10:00:00.000Z', match });
    await svc.create('u1', restored);
    await svc.remove('u1', restored.id);
    expect((await svc.load('u1', space)).jobs).toEqual([]);
    await svc.create('u1', restored);
    expect((await svc.load('u1', space)).jobs[0]).toMatchObject({ createdAt: '2026-11-10T10:00:00.000Z', match });
  });

  it('updates status and events and moves updatedAt', async () => {
    const saved = job();
    await svc.create('u1', saved);
    const before = (await svc.load('u1', space)).jobs[0].updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    const events = [{ kind: 'status' as const, status: 'applied' as const, day: '2026-11-12' }];
    await svc.update('u1', saved.id, { status: 'applied', events });
    const [row] = (await svc.load('u1', space)).jobs;
    expect(row).toMatchObject({ status: 'applied', events });
    expect(row.updatedAt > before).toBe(true);
  });

  it('saves the CV once per space and stamps when it changed', async () => {
    await svc.saveCv('u1', space, 'React dev');
    await svc.saveCv('u1', space, 'React and Node dev');
    const { profile } = await svc.load('u1', space);
    expect(profile.cvText).toBe('React and Node dev');
    expect(profile.cvUpdatedAt).toEqual(expect.any(String));
  });

  it('only matches a job when there is a CV and a description', async () => {
    const bare = job({ description: '' });
    await svc.create('u1', bare);
    await expect(svc.forMatch('u1', bare.id)).rejects.toThrow(BadRequestException);
    await svc.saveCv('u1', space, 'React dev');
    await expect(svc.forMatch('u1', bare.id)).rejects.toThrow('This job has no description to match against');
    await svc.update('u1', bare.id, { description: 'Build our dashboard in React.' });
    expect(await svc.forMatch('u1', bare.id)).toEqual({
      spaceId: space,
      role: 'Frontend Engineer',
      company: 'Acme',
      description: 'Build our dashboard in React.',
      cvText: 'React dev',
    });
  });

  it('stores a match with the time it was made', async () => {
    const saved = job();
    await svc.create('u1', saved);
    const match = await svc.saveMatch('u1', saved.id, { pct: 71, summary: 'Good fit.', skillsHave: ['React'], skillsMissing: [] });
    expect(match).toMatchObject({ pct: 71, matchedAt: expect.any(String) });
    expect((await svc.load('u1', space)).jobs[0].match).toEqual(match);
  });

  it("keeps people out of each other's jobs and out of other tools", async () => {
    const saved = job();
    await svc.create('u1', saved);
    await expect(svc.load('u2', space)).rejects.toThrow(NotFoundException);
    await expect(svc.create('u2', job())).rejects.toThrow(NotFoundException);
    await expect(svc.update('u2', saved.id, { notes: 'mine' })).rejects.toThrow(NotFoundException);
    await expect(svc.remove('u2', saved.id)).rejects.toThrow(NotFoundException);
    await expect(svc.forMatch('u2', saved.id)).rejects.toThrow(NotFoundException);
    await expect(svc.load('u1', theirs)).rejects.toThrow(NotFoundException);
    await expect(svc.load('u1', await addSpace('u1', 'budget'))).rejects.toThrow(NotFoundException);
  });
});
