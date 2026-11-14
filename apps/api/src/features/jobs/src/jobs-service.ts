import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { jobProfiles, jobs, spaces } from '../../../shared/db/schema.ts';
import type { JobChanges, JobEvent, JobFields, Match, NewJob } from './jobs-schemas.ts';

type JobRow = typeof jobs.$inferSelect;
export type JobDto = JobFields & { id: string; match: Match | null; createdAt: string; updatedAt: string };

const iso = (value: string) => new Date(value).toISOString();

function toDto(row: JobRow): JobDto {
  const { spaceId: _space, userId: _user, matchPct, matchSummary, skillsHave, skillsMissing, matchedAt, events, createdAt, updatedAt, ...fields } = row;
  const match =
    matchPct === null || matchedAt === null
      ? null
      : { pct: matchPct, summary: matchSummary ?? '', skillsHave: skillsHave ?? [], skillsMissing: skillsMissing ?? [], matchedAt: iso(matchedAt) };
  return { ...fields, events: events as JobEvent[], match, createdAt: iso(createdAt), updatedAt: iso(updatedAt) };
}

const matchColumns = (match: Match | null | undefined) =>
  match
    ? { matchPct: match.pct, matchSummary: match.summary, skillsHave: match.skillsHave, skillsMissing: match.skillsMissing, matchedAt: match.matchedAt }
    : {};

@Injectable()
export class JobsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async load(userId: string, spaceId: string) {
    await this.assertSpace(userId, spaceId);
    const [[profile], rows] = await Promise.all([
      this.db.select().from(jobProfiles).where(eq(jobProfiles.spaceId, spaceId)),
      this.db.select().from(jobs).where(eq(jobs.spaceId, spaceId)).orderBy(desc(jobs.createdAt), desc(jobs.id)),
    ]);
    return {
      profile: { cvText: profile?.cvText ?? null, cvUpdatedAt: profile?.cvUpdatedAt ? iso(profile.cvUpdatedAt) : null },
      jobs: rows.map(toDto),
    };
  }

  async saveCv(userId: string, spaceId: string, cvText: string | null): Promise<void> {
    await this.assertSpace(userId, spaceId);
    const cvUpdatedAt = new Date().toISOString();
    await this.db
      .insert(jobProfiles)
      .values({ spaceId, userId, cvText, cvUpdatedAt })
      .onConflictDoUpdate({ target: jobProfiles.spaceId, set: { cvText, cvUpdatedAt } });
  }

  async create(userId: string, { match, createdAt, ...job }: NewJob): Promise<void> {
    await this.assertSpace(userId, job.spaceId);
    await this.db.insert(jobs).values({ ...job, userId, ...matchColumns(match), ...(createdAt ? { createdAt } : {}) });
  }

  async update(userId: string, id: string, changes: JobChanges): Promise<void> {
    const saved = await this.db
      .update(jobs)
      .set({ ...changes, updatedAt: new Date().toISOString() })
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });
    if (saved.length === 0) throw new NotFoundException('Job not found');
  }

  async remove(userId: string, id: string): Promise<void> {
    const removed = await this.db
      .delete(jobs)
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });
    if (removed.length === 0) throw new NotFoundException('Job not found');
  }

  async forMatch(userId: string, id: string) {
    const [row] = await this.db
      .select({ spaceId: jobs.spaceId, role: jobs.role, company: jobs.company, description: jobs.description, cvText: jobProfiles.cvText })
      .from(jobs)
      .leftJoin(jobProfiles, eq(jobProfiles.spaceId, jobs.spaceId))
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
    if (!row) throw new NotFoundException('Job not found');
    if (!row.cvText?.trim()) throw new BadRequestException('Add your CV first');
    if (!row.description.trim()) throw new BadRequestException('This job has no description to match against');
    return { ...row, cvText: row.cvText };
  }

  async saveMatch(userId: string, id: string, result: Omit<Match, 'matchedAt'>): Promise<Match> {
    const match = { ...result, matchedAt: new Date().toISOString() };
    const saved = await this.db
      .update(jobs)
      .set(matchColumns(match))
      .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
      .returning({ id: jobs.id });
    if (saved.length === 0) throw new NotFoundException('Job not found');
    return match;
  }

  async assertSpace(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'jobs'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Job hunt space not found');
  }
}
