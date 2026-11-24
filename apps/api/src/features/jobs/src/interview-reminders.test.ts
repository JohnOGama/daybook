import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { jobs, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { InterviewReminderScheduler } from './interview-reminders.ts';

const now = new Date('2026-11-19T09:00:00.000Z');
const minutesFromNow = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();

describe('InterviewReminderScheduler', () => {
  let db: Db;
  let space: string;
  const send = vi.fn(async () => undefined);
  let scheduler: InterviewReminderScheduler;

  const addJob = async (fields: Partial<typeof jobs.$inferInsert> = {}) => {
    const id = crypto.randomUUID();
    await db.insert(jobs).values({ id, spaceId: space, userId: 'u1', role: 'Frontend Engineer', company: 'Acme', status: 'interviewing', events: [], nextStepAt: minutesFromNow(20), nextStepNote: 'Panel with the team', ...fields });
    return id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    space = await insertSpace(db, 'u1', { tool: 'jobs' });
    send.mockReset().mockResolvedValue(undefined);
    scheduler = new InterviewReminderScheduler(db, new SpaceAccessService(db), send, 'https://daybook.example');
  });

  it('emails the owner once, within 30 minutes of the interview, with a link back', async () => {
    await addJob();
    await scheduler.tick(now);
    await scheduler.tick(now);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      to: 'u1@example.com',
      name: 'u1',
      role: 'Frontend Engineer',
      company: 'Acme',
      note: 'Panel with the team',
      minutes: 20,
      link: `https://daybook.example/jobs?space=${space}`,
    });
  });

  it('waits until 30 minutes before, never reminds late, and skips jobs that moved on', async () => {
    await addJob({ nextStepAt: minutesFromNow(31) });
    await addJob({ nextStepAt: minutesFromNow(-5) });
    await addJob({ status: 'rejected' });
    await addJob({ nextStepAt: null });
    await scheduler.tick(now);
    expect(send).not.toHaveBeenCalled();
    await scheduler.tick(new Date(now.getTime() + 60_000));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reminds again when the interview is moved to a new time', async () => {
    const id = await addJob();
    await scheduler.tick(now);
    await db.update(jobs).set({ nextStepAt: minutesFromNow(25) }).where(eq(jobs.id, id));
    await scheduler.tick(now);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('tries again on the next tick when sending fails', async () => {
    await addJob();
    send.mockRejectedValueOnce(new Error('Resend is down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await scheduler.tick(now);
    await scheduler.tick(now);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for a space in Trash', async () => {
    await addJob();
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, space));
    await scheduler.tick(now);
    expect(send).not.toHaveBeenCalled();
  });
});
