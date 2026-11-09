import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces as dbSpaces, tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { TasksService } from './tasks-service.ts';

const today = '2026-11-09';
const onlyToday = { from: today, to: today, today };

describe('TasksService listing and editing', () => {
  let db: Db;
  let svc: TasksService;
  let spaces: Record<string, string>;

  const addTask = async (values: { userId?: string; title?: string; plannedDay?: string; completedOn?: string }) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId: spaces[values.userId ?? 'u1'], title: 't', plannedDay: today, ...values })
      .returning();
    return row;
  };

  const addSubtask = async (parentId: string, values: { title?: string; completedOn?: string; createdAt?: Date } = {}) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId: spaces.u1, title: 's', parentId, ...values })
      .returning();
    return row;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    spaces = { u1: await insertSpace(db, 'u1'), u2: await insertSpace(db, 'u2') };
    svc = new TasksService(db);
  });

  describe('removeMany', () => {
    it('hides the given tasks and their subtasks and leaves the rest', async () => {
      const a = await addTask({ title: 'a' });
      await addSubtask(a.id);
      const b = await addTask({ title: 'b' });
      await addTask({ title: 'keep' });
      await svc.removeMany('u1', [a.id, b.id]);
      expect((await svc.list('u1', spaces.u1, onlyToday)).map((task) => task.title)).toEqual(['keep']);
    });

    it("leaves another user's tasks alone", async () => {
      const theirs = await addTask({ userId: 'u2' });
      await svc.removeMany('u1', [theirs.id]);
      expect(await svc.list('u2', spaces.u2, onlyToday)).toHaveLength(1);
    });
  });

  describe('createMany', () => {
    const item = (title: string, subtasks: string[] = []) => ({
      id: crypto.randomUUID(),
      title,
      subtasks: subtasks.map((subtask) => ({ id: crypto.randomUUID(), title: subtask, subtasks: [] })),
    });

    it('creates tasks and subtasks in the pasted order, after what is already there', async () => {
      await addTask({ title: 'existing' });
      const titles = Array.from({ length: 12 }, (_, index) => `t${index}`);
      await svc.createMany('u1', {
        spaceId: spaces.u1,
        day: today,
        tasks: titles.map((title, index) => item(title, index === 0 ? ['b', 'a', 'c'] : [])),
      });
      const listed = await svc.list('u1', spaces.u1, onlyToday);
      expect(listed.map((task) => task.title)).toEqual(['existing', ...titles]);
      expect(listed[1].subtasks.map((subtask) => subtask.title)).toEqual(['b', 'a', 'c']);
    });

    it("refuses another user's space", async () => {
      await expect(
        svc.createMany('u1', { spaceId: spaces.u2, day: today, tasks: [item('nope')] }),
      ).rejects.toThrow();
      expect(await svc.list('u2', spaces.u2, onlyToday)).toEqual([]);
    });

    it('saves nothing if any part of the list fails', async () => {
      const first = item('first');
      const clash = { ...item('second'), subtasks: [{ id: first.id, title: 'same id as a task', subtasks: [] }] };
      await expect(
        svc.createMany('u1', { spaceId: spaces.u1, day: today, tasks: [first, clash] }),
      ).rejects.toThrow();
      expect(await svc.list('u1', spaces.u1, onlyToday)).toEqual([]);
    });
  });

  it('lists an overdue open task once, on today, and not on its old day', async () => {
    await addTask({ plannedDay: '2026-11-06' });
    const todayList = await svc.list('u1', spaces.u1, onlyToday);
    expect(todayList).toHaveLength(1);
    expect(todayList[0].day).toBe(today);
    expect(await svc.list('u1', spaces.u1, { from: '2026-11-06', to: '2026-11-06', today })).toHaveLength(0);
  });

  it('lists a task finished on a past day on that day only', async () => {
    await addTask({ plannedDay: '2026-11-05', completedOn: '2026-11-06' });
    expect(await svc.list('u1', spaces.u1, onlyToday)).toHaveLength(0);
    const list = await svc.list('u1', spaces.u1, { from: '2026-11-06', to: '2026-11-06', today });
    expect(list[0]).toMatchObject({ finished: true, completedOn: '2026-11-06' });
  });

  it('nests subtasks under the parent, with the parent day, ordered by created time', async () => {
    const parent = await addTask({ plannedDay: '2026-11-06' });
    await addSubtask(parent.id, { title: 'second', createdAt: new Date('2026-11-08T10:00:00Z') });
    await addSubtask(parent.id, { title: 'first', createdAt: new Date('2026-11-07T10:00:00Z') });
    const [listed] = await svc.list('u1', spaces.u1, onlyToday);
    expect(listed.subtasks.map((s) => s.title)).toEqual(['first', 'second']);
    expect(listed.subtasks.every((s) => s.day === today)).toBe(true);
  });

  it('moves a finished subtask forward with its open parent', async () => {
    const parent = await addTask({ plannedDay: '2026-11-07' });
    await addSubtask(parent.id, { completedOn: '2026-11-07' });
    const [listed] = await svc.list('u1', spaces.u1, onlyToday);
    expect(listed.subtasks[0].finished).toBe(true);
  });

  it("never returns another user's tasks", async () => {
    await addTask({ userId: 'u2' });
    expect(await svc.list('u1', spaces.u1, onlyToday)).toHaveLength(0);
  });

  it("never nests another user's subtask under a task", async () => {
    const parent = await addTask({});
    await db.insert(tasks).values({ userId: 'u2', spaceId: spaces.u2, title: 'foreign', parentId: parent.id });
    const [listed] = await svc.list('u1', spaces.u1, onlyToday);
    expect(listed.subtasks).toEqual([]);
  });

  it('lists only the tasks of the requested space', async () => {
    const other = await insertSpace(db, 'u1');
    await db.insert(tasks).values({ userId: 'u1', spaceId: other, title: 'elsewhere', plannedDay: today });
    await addTask({ title: 'here' });
    expect((await svc.list('u1', spaces.u1, onlyToday)).map((t) => t.title)).toEqual(['here']);
    expect((await svc.list('u1', other, onlyToday)).map((t) => t.title)).toEqual(['elsewhere']);
  });

  it("refuses to create a task in another user's space", async () => {
    await expect(svc.create('u1', { spaceId: spaces.u2, title: 'x', day: today })).rejects.toThrow(NotFoundException);
  });

  it('refuses to create a task in a folder', async () => {
    const [folder] = await db.insert(dbSpaces).values({ userId: 'u1', kind: 'folder', title: 'Team' }).returning();
    await expect(svc.create('u1', { spaceId: folder.id, title: 'x', day: today })).rejects.toThrow(BadRequestException);
  });

  it('create uses a client-chosen id', async () => {
    const id = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
    await svc.create('u1', { id, spaceId: spaces.u1, title: 'x', day: today });
    expect((await svc.list('u1', spaces.u1, onlyToday))[0].id).toBe(id);
  });

  it('reports the planned day separately from the day a task appears on', async () => {
    await addTask({ plannedDay: '2026-11-06' });
    expect((await svc.list('u1', spaces.u1, onlyToday))[0]).toMatchObject({ day: today, plannedDay: '2026-11-06' });
  });

  it('create starts a task as To do on the given day', async () => {
    await svc.create('u1', { spaceId: spaces.u1, title: 'new', day: '2026-11-20' });
    const [listed] = await svc.list('u1', spaces.u1, { from: '2026-11-20', to: '2026-11-20', today });
    expect(listed).toMatchObject({ title: 'new', status: 'todo', highPriority: false, finished: false });
  });

  it('update changes status, priority, title and day', async () => {
    const task = await addTask({});
    await svc.update('u1', task.id, { title: 'b', status: 'in_progress', highPriority: true, day: '2026-11-20' });
    const [listed] = await svc.list('u1', spaces.u1, { from: '2026-11-20', to: '2026-11-20', today });
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

  it('reopens a finished task straight into a chosen status', async () => {
    const task = await addTask({ plannedDay: today, completedOn: today });
    await svc.setFinished('u1', task.id, false, today, 'in_progress');
    const [listed] = await svc.list('u1', spaces.u1, onlyToday);
    expect(listed).toMatchObject({ finished: false, completedOn: null, status: 'in_progress' });
  });
});
