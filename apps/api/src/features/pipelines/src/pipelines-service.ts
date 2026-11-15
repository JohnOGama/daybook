import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, notInArray } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { pipelineRuns, pipelineStages } from '../../../shared/db/schema.ts';
import { type DotStatus, dotStatuses } from '../../../shared/utils/pipeline-status.ts';
import type { Report } from './pipelines-schemas.ts';

export type StageStatus = 'running' | 'passed' | 'failed' | 'skipped';
export type RunStatus = 'running' | 'passed' | 'failed';
export type StageView = { name: string; position: number; status: StageStatus; message: string | null; error: string | null; startedAt: string; finishedAt: string | null };
export type RunView = {
  id: string;
  job: string;
  number: number;
  status: RunStatus;
  url: string | null;
  branch: string | null;
  commit: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  finishReason: 'aborted' | null;
  stages: StageView[];
};
export type PipelinesView = { jobs: { job: string; latest: RunView; expected: string[] }[]; recent: RunView[] };

const KEEP_RUNS = 50;
const KEEP_RUNS_PER_SPACE = 500;
const MAX_STAGES = 50;
const RECENT = 30;

type RunRow = typeof pipelineRuns.$inferSelect;
type StageRow = typeof pipelineStages.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const iso = (value: string | null) => (value === null ? null : new Date(value).toISOString());

function toRun(row: RunRow, stages: StageRow[]): RunView {
  return {
    id: row.id,
    job: row.job,
    number: row.number,
    status: row.status as RunStatus,
    url: row.url,
    branch: row.branch,
    commit: row.commit,
    startedAt: iso(row.startedAt) as string,
    updatedAt: iso(row.updatedAt) as string,
    finishedAt: iso(row.finishedAt),
    finishReason: row.finishStatus === 'aborted' ? 'aborted' : null,
    stages: stages.map((stage) => ({
      name: stage.name,
      position: stage.position,
      status: stage.status as StageStatus,
      message: stage.message,
      error: stage.error,
      startedAt: iso(stage.startedAt) as string,
      finishedAt: iso(stage.finishedAt),
    })),
  };
}

// Stores what pipelines report and reads it back. Callers have already checked who may do so.
@Injectable()
export class PipelinesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async report(ownerId: string, spaceId: string, report: Report): Promise<void> {
    await this.db.transaction(async (tx) => {
      const run = await this.runFor(tx, ownerId, spaceId, report);
      const now = new Date().toISOString();
      if (report.stage) await this.stage(tx, run.id, report.stage, report, now);
      else await tx.update(pipelineRuns).set({ finishStatus: report.status, finishedAt: now }).where(eq(pipelineRuns.id, run.id));

      // A run fails as soon as any stage fails; it passes only when its finish report says so.
      const [{ failed }] = await tx
        .select({ failed: count() })
        .from(pipelineStages)
        .where(and(eq(pipelineStages.runId, run.id), eq(pipelineStages.status, 'failed')));
      const [current] = await tx.select({ finishStatus: pipelineRuns.finishStatus }).from(pipelineRuns).where(eq(pipelineRuns.id, run.id));
      const finish = current.finishStatus;
      const status: RunStatus = failed > 0 || finish === 'failed' || finish === 'aborted' ? 'failed' : finish === 'passed' ? 'passed' : 'running';
      await tx
        .update(pipelineRuns)
        .set({
          status,
          updatedAt: now,
          ...(report.url !== undefined && { url: report.url }),
          ...(report.branch !== undefined && { branch: report.branch }),
          ...(report.commit !== undefined && { commit: report.commit }),
        })
        .where(eq(pipelineRuns.id, run.id));
    });
  }

  async load(spaceId: string): Promise<PipelinesView> {
    const runs = await this.db.select().from(pipelineRuns).where(eq(pipelineRuns.spaceId, spaceId)).orderBy(desc(pipelineRuns.startedAt), desc(pipelineRuns.number));
    const latest = new Map<string, RunRow>();
    const lastFinished = new Map<string, RunRow>();
    for (const run of runs) {
      if ((latest.get(run.job)?.number ?? 0) < run.number) latest.set(run.job, run);
      if (run.finishedAt && (lastFinished.get(run.job)?.number ?? 0) < run.number) lastFinished.set(run.job, run);
    }
    const recent = runs.slice(0, RECENT);
    const needed = [...new Set([...latest.values(), ...lastFinished.values(), ...recent].map((run) => run.id))];
    const stages = await this.stagesOf(needed);
    const view = (run: RunRow) => toRun(run, stages.get(run.id) ?? []);
    return {
      jobs: [...latest.values()]
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((run) => {
          const finished = lastFinished.get(run.job);
          return { job: run.job, latest: view(run), expected: finished ? (stages.get(finished.id) ?? []).map((stage) => stage.name) : [] };
        }),
      recent: recent.map(view),
    };
  }

  async run(runId: string): Promise<RunView> {
    const [row] = await this.db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId));
    if (!row) throw new NotFoundException('Run not found');
    return toRun(row, (await this.stagesOf([row.id])).get(row.id) ?? []);
  }

  async dotStatus(spaceId: string, now = new Date()): Promise<DotStatus> {
    return (await dotStatuses(this.db, [spaceId], now)).get(spaceId) ?? null;
  }

  // The run this report is about, created on its first report; creating one drops that job's runs past the newest 50.
  private async runFor(tx: Tx, ownerId: string, spaceId: string, report: Report): Promise<RunRow> {
    const inserted = await tx
      .insert(pipelineRuns)
      .values({ spaceId, userId: ownerId, job: report.job, number: report.run, status: 'running', url: report.url, branch: report.branch, commit: report.commit })
      .onConflictDoNothing()
      .returning();
    const match = and(eq(pipelineRuns.spaceId, spaceId), eq(pipelineRuns.job, report.job));
    if (inserted.length > 0) {
      const keep = tx.select({ id: pipelineRuns.id }).from(pipelineRuns).where(match).orderBy(desc(pipelineRuns.number)).limit(KEEP_RUNS);
      await tx.delete(pipelineRuns).where(and(match, notInArray(pipelineRuns.id, keep)));
      // Also a cap for the whole space, since jobs can come and go (a job per branch) and are never pruned otherwise.
      const inSpace = eq(pipelineRuns.spaceId, spaceId);
      const keepInSpace = tx.select({ id: pipelineRuns.id }).from(pipelineRuns).where(inSpace).orderBy(desc(pipelineRuns.startedAt), desc(pipelineRuns.id)).limit(KEEP_RUNS_PER_SPACE);
      await tx.delete(pipelineRuns).where(and(inSpace, notInArray(pipelineRuns.id, keepInSpace)));
      return inserted[0];
    }
    // Locked until this report commits, so two reports for one run (parallel stages) apply one after the other:
    // the run's status and each new stage's position are worked out from what the other one wrote.
    const [existing] = await tx.select().from(pipelineRuns).where(and(match, eq(pipelineRuns.number, report.run))).for('update');
    return existing;
  }

  // A stage is created at its first report, in the order stages first appear. A finished stage never goes back to running,
  // so a late or repeated `started` changes nothing.
  private async stage(tx: Tx, runId: string, name: string, report: Report, now: string): Promise<void> {
    const status = (report.status === 'started' ? 'running' : report.status) as StageStatus;
    const finishedAt = status === 'running' ? null : now;
    const [existing] = await tx.select().from(pipelineStages).where(and(eq(pipelineStages.runId, runId), eq(pipelineStages.name, name)));
    if (!existing) {
      const [{ stages }] = await tx.select({ stages: count() }).from(pipelineStages).where(eq(pipelineStages.runId, runId));
      if (stages >= MAX_STAGES) throw new BadRequestException(`A run can have at most ${MAX_STAGES} stages`);
      await tx
        .insert(pipelineStages)
        .values({ runId, name, position: stages, status, message: report.message ?? null, error: report.error ?? null, finishedAt })
        .onConflictDoNothing();
      return;
    }
    if (status === 'running') {
      if (report.message !== undefined && existing.status === 'running') await tx.update(pipelineStages).set({ message: report.message }).where(eq(pipelineStages.id, existing.id));
      return;
    }
    await tx
      .update(pipelineStages)
      .set({
        status,
        finishedAt,
        ...(report.message !== undefined && { message: report.message }),
        ...(report.error !== undefined && { error: report.error }),
      })
      .where(eq(pipelineStages.id, existing.id));
  }

  private async stagesOf(runIds: string[]): Promise<Map<string, StageRow[]>> {
    const byRun = new Map<string, StageRow[]>();
    if (runIds.length === 0) return byRun;
    const rows = await this.db.select().from(pipelineStages).where(inArray(pipelineStages.runId, runIds)).orderBy(asc(pipelineStages.position));
    for (const row of rows) byRun.set(row.runId, [...(byRun.get(row.runId) ?? []), row]);
    return byRun;
  }
}
