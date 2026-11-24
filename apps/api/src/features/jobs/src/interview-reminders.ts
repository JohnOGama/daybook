import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { and, eq, gt, isNull, lte, ne, or } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { user } from '../../../shared/db/auth-schema.ts';
import { jobs, spaces } from '../../../shared/db/schema.ts';
import type { InterviewReminderSender } from '../../../shared/services/email-service.ts';
import { SpaceAccessService } from '../../spaces/index.ts';

export const INTERVIEW_MAILER = Symbol('INTERVIEW_MAILER');
// Where the email's link points: the site's address, as in BETTER_AUTH_URL.
export const SITE_URL = Symbol('SITE_URL');

export const REMIND_BEFORE_MS = 30 * 60_000;
const TICK_MS = 60_000;

// Emails the space owner once, 30 minutes before each booked interview (a job in Interviewing with a `nextStepAt`).
// A second background job beside the uptime scheduler, in the same single API process; nothing is sent while the API is
// down, and an interview whose time has already passed is never reminded late.
@Injectable()
export class InterviewReminderScheduler implements OnModuleInit, OnApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(INTERVIEW_MAILER) private readonly send: InterviewReminderSender,
    @Inject(SITE_URL) private readonly siteUrl: string,
  ) {}

  onModuleInit(): void {
    if (process.env.VITEST) return;
    this.timer = setInterval(() => this.tick().catch((error) => console.error('Interview reminders failed', error)), TICK_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const due of await this.due(now)) await this.remind(due, now);
    } finally {
      this.running = false;
    }
  }

  // Interviews starting within the next 30 minutes that haven't been reminded for this time yet, in live Job hunt spaces.
  private due(now: Date) {
    return this.db
      .select({
        id: jobs.id,
        spaceId: jobs.spaceId,
        role: jobs.role,
        company: jobs.company,
        note: jobs.nextStepNote,
        at: jobs.nextStepAt,
        email: user.email,
        name: user.name,
      })
      .from(jobs)
      .innerJoin(spaces, eq(spaces.id, jobs.spaceId))
      .innerJoin(user, eq(user.id, jobs.userId))
      .where(
        and(
          eq(jobs.status, 'interviewing'),
          gt(jobs.nextStepAt, now.toISOString()),
          lte(jobs.nextStepAt, new Date(now.getTime() + REMIND_BEFORE_MS).toISOString()),
          or(isNull(jobs.reminderSentFor), ne(jobs.reminderSentFor, jobs.nextStepAt)),
          eq(spaces.tool, 'jobs'),
          isNull(spaces.deletedAt),
        ),
      );
  }

  private async remind(due: Awaited<ReturnType<InterviewReminderScheduler['due']>>[number], now: Date): Promise<void> {
    // A folder or group above the space in Trash hides it too.
    if ((await this.access.viewerIds(due.spaceId)).length === 0) return;
    // Claimed before sending, only while the time is still the one found, so a reminder goes out once even if ticks overlap.
    const claimed = await this.db
      .update(jobs)
      .set({ reminderSentFor: due.at })
      .where(and(eq(jobs.id, due.id), eq(jobs.nextStepAt, due.at as string), or(isNull(jobs.reminderSentFor), ne(jobs.reminderSentFor, jobs.nextStepAt))))
      .returning({ id: jobs.id });
    if (claimed.length === 0) return;
    try {
      await this.send({
        to: due.email,
        name: due.name,
        role: due.role,
        company: due.company,
        note: due.note,
        minutes: Math.round((new Date(due.at as string).getTime() - now.getTime()) / 60_000),
        link: `${this.siteUrl}/jobs?space=${due.spaceId}`,
      });
    } catch (error) {
      // Released so the next tick tries again, while the interview is still ahead.
      await this.db.update(jobs).set({ reminderSentFor: null }).where(eq(jobs.id, due.id));
      console.error('Could not send an interview reminder', error);
    }
  }
}
