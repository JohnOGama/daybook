import { BadRequestException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { TasksService } from './tasks-service.ts';

const today = '2026-11-09';
const earlier = '2026-11-07';

describe('finishing, subtasks and deletion', () => {
  let db: Db;
  let svc: TasksService;

  const addParent = async (values: { userId?: string; plannedDay?: string; completedOn?: string } = {}) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', title: 'p', plannedDay: today, ...values })
      .returning();
    return row.id;
  };

  const addSub = async (parentId: string, completedOn?: string) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', title: 's', parentId, completedOn })
      .returning();
    return row.id;
  };

  const read = async (id: string) => {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
    return row;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new TasksService(db);
  });

  it('finishing the last open subtask finishes the parent', async () => {
    const p = await addParent();
    const a = await addSub(p, earlier);
    const b = await addSub(p);
    await svc.setFinished('u1', b, true, today);
    expect((await read(p)).completedOn).toBe(today);
    expect((await read(a)).completedOn).toBe(earlier);
  });

  it('stays open while any subtask is open', async () => {
    const p = await addParent();
    const a = await addSub(p);
    await addSub(p);
    await svc.setFinished('u1', a, true, today);
    expect((await read(p)).completedOn).toBeNull();
  });

  it('ticking a parent finishes all subtasks, keeping earlier finish days', async () => {
    const p = await addParent();
    const a = await addSub(p, earlier);
    const b = await addSub(p);
    await svc.setFinished('u1', p, true, today);
    expect((await read(p)).completedOn).toBe(today);
    expect((await read(a)).completedOn).toBe(earlier);
    expect((await read(b)).completedOn).toBe(today);
  });

  it('unticking a parent unticks all subtasks and sets status todo', async () => {
    const p = await addParent({ completedOn: today });
    const a = await addSub(p, today);
    await db.update(tasks).set({ status: 'in_progress' }).where(eq(tasks.id, p));
    await svc.setFinished('u1', p, false, today);
    expect(await read(p)).toMatchObject({ completedOn: null, status: 'todo' });
    expect((await read(a)).completedOn).toBeNull();
  });

  it('unticking an already open task leaves its status alone', async () => {
    const p = await addParent();
    await db.update(tasks).set({ status: 'in_progress' }).where(eq(tasks.id, p));
    await svc.setFinished('u1', p, false, today);
    expect((await read(p)).status).toBe('in_progress');
  });

  it('unticking a subtask reopens a finished parent', async () => {
    const p = await addParent({ completedOn: today });
    const a = await addSub(p, today);
    await svc.setFinished('u1', a, false, today);
    expect((await read(a)).completedOn).toBeNull();
    expect((await read(p)).completedOn).toBeNull();
  });

  it('reopened task from a past day appears on today', async () => {
    const p = await addParent({ plannedDay: '2026-11-05', completedOn: '2026-11-05' });
    await svc.setFinished('u1', p, false, today);
    const list = await svc.list('u1', { from: today, to: today, today });
    expect(list.map((t) => t.id)).toEqual([p]);
  });

  it('adding a subtask to a finished parent reopens it', async () => {
    const p = await addParent({ completedOn: today });
    await svc.createSubtask('u1', p, { title: 'more' });
    expect((await read(p)).completedOn).toBeNull();
  });

  it('refuses a subtask under a subtask', async () => {
    const p = await addParent();
    const a = await addSub(p);
    await expect(svc.createSubtask('u1', a, { title: 'x' })).rejects.toThrow(BadRequestException);
  });

  it("refuses a subtask under another user's task", async () => {
    const p = await addParent({ userId: 'u2' });
    await expect(svc.createSubtask('u1', p, { title: 'x' })).rejects.toThrow(NotFoundException);
  });

  it("refuses finishing another user's task", async () => {
    const p = await addParent({ userId: 'u2' });
    await expect(svc.setFinished('u1', p, true, today)).rejects.toThrow(NotFoundException);
  });

  it("refuses deleting another user's task", async () => {
    const p = await addParent({ userId: 'u2' });
    await expect(svc.remove('u1', p, today)).rejects.toThrow(NotFoundException);
    expect(await read(p)).toBeDefined();
  });

  it('deleting a parent deletes subtasks', async () => {
    const p = await addParent();
    await addSub(p);
    await svc.remove('u1', p, today);
    expect(await db.select().from(tasks)).toHaveLength(0);
  });

  it('deleting the last open subtask finishes the parent when finished subtasks remain', async () => {
    const p = await addParent();
    await addSub(p, earlier);
    const b = await addSub(p);
    await svc.remove('u1', b, today);
    expect((await read(p)).completedOn).toBe(today);
  });

  it('deleting the only subtask leaves the parent unchanged', async () => {
    const p = await addParent();
    const a = await addSub(p);
    await svc.remove('u1', a, today);
    expect((await read(p)).completedOn).toBeNull();
  });

  // PGlite runs these one after the other, so this pins the outcome, not the row lock.
  it('two subtasks ticked in the same moment finish the parent', async () => {
    const p = await addParent();
    const a = await addSub(p);
    const b = await addSub(p);
    await Promise.all([svc.setFinished('u1', a, true, today), svc.setFinished('u1', b, true, today)]);
    expect((await svc.list('u1', { from: today, to: today, today }))[0].finished).toBe(true);
  });
});
