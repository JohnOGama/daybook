import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { TasksService } from './tasks-service.ts';

const today = '2026-11-09';
const onlyToday = { from: today, to: today, today };

describe('TasksService listing and editing', () => {
  let db: Db;
  let svc: TasksService;

  const addTask = async (values: { userId?: string; title?: string; plannedDay?: string; completedOn?: string }) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', title: 't', plannedDay: today, ...values })
      .returning();
    return row;
  };

  const addSubtask = async (parentId: string, values: { title?: string; completedOn?: string; createdAt?: Date } = {}) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', title: 's', parentId, ...values })
      .returning();
    return row;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new TasksService(db);
  });

  it('lists an overdue open task once, on today, and not on its old day', async () => {
    await addTask({ plannedDay: '2026-11-06' });
    const todayList = await svc.list('u1', onlyToday);
    expect(todayList).toHaveLength(1);
    expect(todayList[0].day).toBe(today);
    expect(await svc.list('u1', { from: '2026-11-06', to: '2026-11-06', today })).toHaveLength(0);
  });

  it('lists a task finished on a past day on that day only', async () => {
    await addTask({ plannedDay: '2026-11-05', completedOn: '2026-11-06' });
    expect(await svc.list('u1', onlyToday)).toHaveLength(0);
    const list = await svc.list('u1', { from: '2026-11-06', to: '2026-11-06', today });
    expect(list[0].finished).toBe(true);
  });

  it('nests subtasks under the parent, with the parent day, ordered by created time', async () => {
    const parent = await addTask({ plannedDay: '2026-11-06' });
    await addSubtask(parent.id, { title: 'second', createdAt: new Date('2026-11-08T10:00:00Z') });
    await addSubtask(parent.id, { title: 'first', createdAt: new Date('2026-11-07T10:00:00Z') });
    const [listed] = await svc.list('u1', onlyToday);
    expect(listed.subtasks.map((s) => s.title)).toEqual(['first', 'second']);
    expect(listed.subtasks.every((s) => s.day === today)).toBe(true);
  });

  it('moves a finished subtask forward with its open parent', async () => {
    const parent = await addTask({ plannedDay: '2026-11-07' });
    await addSubtask(parent.id, { completedOn: '2026-11-07' });
    const [listed] = await svc.list('u1', onlyToday);
    expect(listed.subtasks[0].finished).toBe(true);
  });

  it("never returns another user's tasks", async () => {
    await addTask({ userId: 'u2' });
    expect(await svc.list('u1', onlyToday)).toHaveLength(0);
  });

  it("never nests another user's subtask under a task", async () => {
    const parent = await addTask({});
    await db.insert(tasks).values({ userId: 'u2', title: 'foreign', parentId: parent.id });
    const [listed] = await svc.list('u1', onlyToday);
    expect(listed.subtasks).toEqual([]);
  });

  it('create starts a task as To do on the given day', async () => {
    await svc.create('u1', { title: 'new', day: '2026-11-20' });
    const [listed] = await svc.list('u1', { from: '2026-11-20', to: '2026-11-20', today });
    expect(listed).toMatchObject({ title: 'new', status: 'todo', highPriority: false, finished: false });
  });

  it('update changes status, priority, title and day', async () => {
    const task = await addTask({});
    await svc.update('u1', task.id, { title: 'b', status: 'in_progress', highPriority: true, day: '2026-11-20' });
    const [listed] = await svc.list('u1', { from: '2026-11-20', to: '2026-11-20', today });
    expect(listed).toMatchObject({ title: 'b', status: 'in_progress', highPriority: true });
  });

  it("update throws NotFoundException for another user's task", async () => {
    const task = await addTask({ userId: 'u2' });
    await expect(svc.update('u1', task.id, { title: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('update rejects a day change on a subtask', async () => {
    const parent = await addTask({});
    const sub = await addSubtask(parent.id);
    await expect(svc.update('u1', sub.id, { day: '2026-11-20' })).rejects.toThrow(BadRequestException);
  });

  it('update rejects a day change on a finished task', async () => {
    const task = await addTask({ completedOn: today });
    await expect(svc.update('u1', task.id, { day: '2026-11-20' })).rejects.toThrow(BadRequestException);
  });
});
