import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { pipelineRuns, pipelineStages } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { reportSchema } from './pipelines-schemas.ts';
import { PipelinesService } from './pipelines-service.ts';

describe('PipelinesService', () => {
  let db: Db;
  let svc: PipelinesService;
  let space: string;

  const send = (body: Record<string, unknown>) => svc.report('u1', space, reportSchema.parse({ job: 'api', run: '1', ...body }));
  const latest = async (job = 'api') => (await svc.load(space)).jobs.find((j) => j.job === job)?.latest;

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    svc = new PipelinesService(db);
    space = await insertSpace(db, 'u1', { tool: 'pipelines' });
  });

  it('a started stage makes a running run and a running stage at position 0', async () => {
    await send({ stage: 'Build', status: 'started' });
    const run = await latest();
    expect(run).toMatchObject({ job: 'api', number: 1, status: 'running' });
    expect(run?.stages).toEqual([expect.objectContaining({ name: 'Build', position: 0, status: 'running', finishedAt: null })]);
  });

  it('passed finishes the stage; the run stays running until the finish report', async () => {
    await send({ stage: 'Build', status: 'started' });
    await send({ stage: 'Build', status: 'passed', message: 'Built image' });
    let run = await latest();
    expect(run?.stages[0]).toMatchObject({ status: 'passed', message: 'Built image' });
    expect(run?.stages[0].finishedAt).toEqual(expect.any(String));
    expect(run?.status).toBe('running');
    await send({ status: 'passed' });
    run = await latest();
    expect(run).toMatchObject({ status: 'passed', finishReason: null });
    expect(run?.finishedAt).toEqual(expect.any(String));
  });

  it('a failed stage fails the run, and a finish report with passed keeps it failed', async () => {
    await send({ stage: 'Test', status: 'started' });
    await send({ stage: 'Test', status: 'failed', message: '3 tests failed', error: 'FAIL auth.spec.ts' });
    expect((await latest())?.status).toBe('failed');
    await send({ status: 'passed' });
    const run = await latest();
    expect(run?.status).toBe('failed');
    expect(run?.stages[0]).toMatchObject({ status: 'failed', error: 'FAIL auth.spec.ts' });
  });

  it('finish with aborted marks the run failed with finishReason aborted', async () => {
    await send({ stage: 'Deploy', status: 'started' });
    await send({ status: 'aborted' });
    expect(await latest()).toMatchObject({ status: 'failed', finishReason: 'aborted' });
  });

  it('out-of-order and repeated reports converge', async () => {
    await send({ stage: 'Build', status: 'passed' });
    await send({ stage: 'Build', status: 'started' });
    await send({ stage: 'Test', status: 'started' });
    await send({ stage: 'Test', status: 'started' });
    const run = await latest();
    expect(run?.stages.map((s) => [s.name, s.position, s.status])).toEqual([
      ['Build', 0, 'passed'],
      ['Test', 1, 'running'],
    ]);
    expect(await db.select().from(pipelineStages)).toHaveLength(2);
  });

  it('keeps only the 50 newest runs per job', async () => {
    for (let number = 1; number <= 51; number++) await send({ run: number, stage: 'Build', status: 'started' });
    await svc.report('u1', space, reportSchema.parse({ job: 'web', run: 1, stage: 'Build', status: 'started' }));
    const runs = await db.select().from(pipelineRuns);
    const api = runs.filter((r) => r.job === 'api').map((r) => r.number);
    expect(api).toHaveLength(50);
    expect(api).not.toContain(1);
    expect(runs.filter((r) => r.job === 'web')).toHaveLength(1);
  });

  it('refuses a 51st stage', async () => {
    for (let index = 0; index < 50; index++) await send({ stage: `S${index}`, status: 'started' });
    await expect(send({ stage: 'S50', status: 'started' })).rejects.toThrow(BadRequestException);
  });

  it('expected stages come from the last finished run of the job', async () => {
    for (const stage of ['Checkout', 'Build', 'Test']) {
      await send({ run: 1, stage, status: 'started' });
      await send({ run: 1, stage, status: 'passed' });
    }
    await send({ run: 1, status: 'passed' });
    await send({ run: 2, stage: 'Checkout', status: 'started' });
    const job = (await svc.load(space)).jobs.find((j) => j.job === 'api');
    expect(job?.latest.number).toBe(2);
    expect(job?.expected).toEqual(['Checkout', 'Build', 'Test']);
  });

  it('dotStatus: failed beats running beats passed; null with no runs; a running run older than 30 minutes counts as failed', async () => {
    expect(await svc.dotStatus(space)).toBeNull();
    await svc.report('u1', space, reportSchema.parse({ job: 'a', run: 1, status: 'passed' }));
    expect(await svc.dotStatus(space)).toBe('passed');
    await svc.report('u1', space, reportSchema.parse({ job: 'b', run: 1, stage: 'Build', status: 'started' }));
    expect(await svc.dotStatus(space)).toBe('running');
    expect(await svc.dotStatus(space, new Date(Date.now() + 31 * 60_000))).toBe('failed');
    await svc.report('u1', space, reportSchema.parse({ job: 'c', run: 1, stage: 'Test', status: 'failed' }));
    expect(await svc.dotStatus(space)).toBe('failed');
  });

  it('stores every row under the owner', async () => {
    await send({ stage: 'Build', status: 'started' });
    expect((await db.select().from(pipelineRuns)).every((r) => r.userId === 'u1')).toBe(true);
  });

  it('recent lists the newest runs across jobs with their stages', async () => {
    await svc.report('u1', space, reportSchema.parse({ job: 'a', run: 1, stage: 'Build', status: 'started' }));
    await svc.report('u1', space, reportSchema.parse({ job: 'b', run: 7, stage: 'Test', status: 'failed' }));
    const { recent } = await svc.load(space);
    expect(recent.map((r) => `${r.job}#${r.number}`)).toEqual(['b#7', 'a#1']);
    expect(recent[0].stages[0].name).toBe('Test');
  });
});

describe('reportSchema', () => {
  it('cuts error to its last 8,000 characters and refuses a javascript: url', () => {
    const parsed = reportSchema.parse({ job: 'api', run: '12', stage: 'Test', status: 'failed', error: `${'a'.repeat(100)}${'b'.repeat(8000)}` });
    expect(parsed.run).toBe(12);
    expect(parsed.error).toBe('b'.repeat(8000));
    expect(reportSchema.safeParse({ job: 'api', run: 1, status: 'passed', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(reportSchema.safeParse({ job: 'api', run: 1, status: 'passed', url: 'https://jenkins.example.com/job/api/1/' }).success).toBe(true);
  });

  it('refuses a stage status without a stage, a finish status with a stage, and a run that is not a positive integer', () => {
    expect(reportSchema.safeParse({ job: 'api', run: 1, status: 'started' }).success).toBe(false);
    expect(reportSchema.safeParse({ job: 'api', run: 1, stage: 'Build', status: 'aborted' }).success).toBe(false);
    expect(reportSchema.safeParse({ job: 'api', run: '0', stage: 'Build', status: 'started' }).success).toBe(false);
    expect(reportSchema.safeParse({ job: 'api', run: 'abc', stage: 'Build', status: 'started' }).success).toBe(false);
    expect(reportSchema.safeParse({ job: '', run: 1, status: 'passed' }).success).toBe(false);
  });
});
