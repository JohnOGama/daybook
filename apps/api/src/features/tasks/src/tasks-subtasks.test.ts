import { BadRequestException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces as dbSpaces, tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpacesService } from '../../spaces/src/spaces-service.ts';
import { TrashService } from '../../trash/src/trash-service.ts';
import { TasksService } from './tasks-service.ts';

const today = '2026-11-09';
const earlier = '2026-11-07';

describe('finishing, subtasks and deletion', () => {
  let db: Db;
  let svc: TasksService;
  let spaces: Record<string, string>;

  const addParent = async (values: { userId?: string; plannedDay?: string; completedOn?: string } = {}) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId: spaces[values.userId ?? 'u1'], title: 'p', plannedDay: today, ...values })
      .returning();
    return row.id;
  };

  const addSub = async (parentId: string, completedOn?: string) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId: spaces.u1, title: 's', parentId, completedOn })
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
    spaces = { u1: await insertSpace(db, 'u1'), u2: await insertSpace(db, 'u2') };
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
    const list = await svc.list('u1', spaces.u1, { from: today, to: today, today });
    expect(list.map((t) => t.id)).toEqual([p]);
  });

  it('uses a client-chosen id for a subtask', async () => {
    const p = await addParent();
    const id = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
    await svc.createSubtask('u1', p, { id, title: 'child' });
    expect((await read(id)).parentId).toBe(p);
  });

  it('uses client-chosen ids for a copy and its subtasks', async () => {
    const p = await addParent();
    const a = await addSub(p);
    const newParent = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
    const newChild = '7f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c22';
    await svc.copy('u1', p, today, undefined, { [p]: newParent, [a]: newChild });
    expect((await read(newParent)).title).toBe('p (copy)');
    expect((await read(newChild)).parentId).toBe(newParent);
  });

  it('a new subtask belongs to its parent space', async () => {
    const p = await addParent();
    await svc.createSubtask('u1', p, { title: 'child' });
    const rows = await db.select().from(tasks);
    expect(rows.every((row) => row.spaceId === spaces.u1)).toBe(true);
  });

  it('adding a subtask to a finished parent reopens it', async () => {
    const p = await addParent({ completedOn: today });
    await svc.createSubtask('u1', p, { title: 'more' });
    expect((await read(p)).completedOn).toBeNull();
  });

  it('allows a subtask under a subtask', async () => {
    const p = await addParent();
    const a = await addSub(p);
    const id = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
    await svc.createSubtask('u1', a, { id, title: 'x' });
    expect((await read(id)).parentId).toBe(a);
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

  describe('copy', () => {
    const listToday = () => svc.list('u1', spaces.u1, { from: today, to: today, today });

    it('copies a parent and its subtasks, in order, leaving the original alone', async () => {
      const p = await addParent();
      await db.update(tasks).set({ title: 'Plan' }).where(eq(tasks.id, p));
      const a = await addSub(p);
      const b = await addSub(p);
      await db.update(tasks).set({ title: 'first', createdAt: new Date('2026-11-01T10:00:00Z') }).where(eq(tasks.id, a));
      await db.update(tasks).set({ title: 'second', createdAt: new Date('2026-11-02T10:00:00Z') }).where(eq(tasks.id, b));
      await svc.copy('u1', p, today);
      const list = await listToday();
      expect(list.map((t) => t.title)).toEqual(['Plan', 'Plan (copy)']);
      expect(list[0].id).toBe(p);
      expect(list[1].id).not.toBe(p);
      expect(list[1].subtasks.map((s) => s.title)).toEqual(['first', 'second']);
      expect(list[0].subtasks).toHaveLength(2);
    });

    it('keeps the copy and its subtasks in the same space', async () => {
      const p = await addParent();
      await addSub(p);
      await svc.copy('u1', p, today);
      const rows = await db.select().from(tasks);
      expect(rows).toHaveLength(4);
      expect(rows.every((row) => row.spaceId === spaces.u1)).toBe(true);
    });

    it('keeps the status and priority of open tasks', async () => {
      const p = await addParent();
      await db.update(tasks).set({ status: 'on_hold', highPriority: true }).where(eq(tasks.id, p));
      await svc.copy('u1', p, today);
      expect((await listToday())[1]).toMatchObject({ status: 'on_hold', highPriority: true, finished: false });
    });

    it('makes everything unfinished and To do when copying finished work', async () => {
      const p = await addParent({ completedOn: today });
      const a = await addSub(p, today);
      await db.update(tasks).set({ status: 'in_progress' }).where(eq(tasks.id, a));
      await svc.copy('u1', p, today);
      const copy = (await listToday()).find((t) => t.title === 'p (copy)')!;
      expect(copy.finished).toBe(false);
      expect(copy.subtasks[0]).toMatchObject({ finished: false, status: 'todo' });
    });

    it('puts a copy of a future task on that future day', async () => {
      const p = await addParent({ plannedDay: '2026-11-20' });
      await svc.copy('u1', p, today);
      expect(await svc.list('u1', spaces.u1, { from: '2026-11-20', to: '2026-11-20', today })).toHaveLength(2);
    });

    it('stays within the 200-character title limit', async () => {
      const p = await addParent();
      await db.update(tasks).set({ title: 'a'.repeat(200) }).where(eq(tasks.id, p));
      await svc.copy('u1', p, today);
      const copy = (await listToday())[1];
      expect(copy.title).toHaveLength(200);
      expect(copy.title.endsWith(' (copy)')).toBe(true);
    });

    it('refuses to copy a subtask on its own', async () => {
      const p = await addParent();
      const a = await addSub(p);
      await expect(svc.copy('u1', a, today)).rejects.toThrow(BadRequestException);
    });

    it("refuses to copy another user's task", async () => {
      const p = await addParent({ userId: 'u2' });
      await expect(svc.copy('u1', p, today)).rejects.toThrow(NotFoundException);
    });
  });

  describe('copy to another space', () => {
    let other: string;

    beforeEach(async () => {
      other = await insertSpace(db, 'u1');
    });

    it('copies the parent and subtasks there with the original title', async () => {
      const p = await addParent();
      await addSub(p);
      await svc.copy('u1', p, today, other);
      const copied = await svc.list('u1', other, { from: today, to: today, today });
      expect(copied.map((t) => t.title)).toEqual(['p']);
      expect(copied[0].subtasks.map((s) => s.title)).toEqual(['s']);
      expect(await svc.list('u1', spaces.u1, { from: today, to: today, today })).toHaveLength(1);
    });

    it('marks it as a copy when the target is the same space', async () => {
      const p = await addParent();
      await svc.copy('u1', p, today, spaces.u1);
      const list = await svc.list('u1', spaces.u1, { from: today, to: today, today });
      expect(list.map((t) => t.title)).toEqual(['p', 'p (copy)']);
    });

    it("refuses another user's space", async () => {
      const p = await addParent();
      await expect(svc.copy('u1', p, today, spaces.u2)).rejects.toThrow(NotFoundException);
    });

    it('refuses a folder', async () => {
      const p = await addParent();
      const [folder] = await db.insert(dbSpaces).values({ userId: 'u1', kind: 'folder', title: 'F' }).returning();
      await expect(svc.copy('u1', p, today, folder.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deep nesting', () => {
    const chain = async () => {
      const root = await addParent();
      const middle = await addSub(root);
      const leaf = await addSub(middle);
      return { root, middle, leaf };
    };
    const done = async (id: string) => (await read(id)).completedOn !== null;

    it('finishing the last leaf finishes every parent above it', async () => {
      const { root, middle, leaf } = await chain();
      await svc.setFinished('u1', leaf, true, today);
      expect([await done(leaf), await done(middle), await done(root)]).toEqual([true, true, true]);
    });

    it('stops going up at a parent with other open work', async () => {
      const { root, middle, leaf } = await chain();
      await addSub(root);
      await svc.setFinished('u1', leaf, true, today);
      expect([await done(middle), await done(root)]).toEqual([true, false]);
    });

    it('finishing a task finishes everything under it', async () => {
      const { root, middle, leaf } = await chain();
      await svc.setFinished('u1', root, true, today);
      expect([await done(middle), await done(leaf)]).toEqual([true, true]);
    });

    it('reopening a leaf reopens every parent but not its siblings', async () => {
      const { root, middle, leaf } = await chain();
      const sibling = await addSub(middle);
      await svc.setFinished('u1', root, true, today);
      await svc.setFinished('u1', leaf, false, today);
      expect([await done(leaf), await done(middle), await done(root), await done(sibling)]).toEqual([false, false, false, true]);
    });

    it('adding a subtask deep inside a finished task reopens the whole chain', async () => {
      const { root, middle, leaf } = await chain();
      await svc.setFinished('u1', root, true, today);
      await svc.createSubtask('u1', leaf, { title: 'new' });
      expect([await done(leaf), await done(middle), await done(root)]).toEqual([false, false, false]);
    });

    it('deleting the last open leaf finishes the parents above it', async () => {
      const { root, middle, leaf } = await chain();
      const finishedLeaf = await addSub(middle, today);
      await svc.remove('u1', leaf, today);
      expect([await done(finishedLeaf), await done(middle), await done(root)]).toEqual([true, true, true]);
    });

    it('copies the whole tree with the structure intact', async () => {
      const { root } = await chain();
      await svc.copy('u1', root, today);
      const listed = await svc.list('u1', spaces.u1, { from: today, to: today, today });
      expect(listed).toHaveLength(2);
      expect(listed[1].subtasks[0].subtasks).toHaveLength(1);
      expect(listed[1].subtasks[0].subtasks[0].id).not.toBe(listed[0].subtasks[0].subtasks[0].id);
    });

    it('restoring a deep task brings back its deleted parents and reopens them', async () => {
      const { root, middle, leaf } = await chain();
      await svc.remove('u1', leaf, today);
      await svc.setFinished('u1', middle, true, today);
      await svc.remove('u1', middle, today);
      await new TrashService(db).restoreTask('u1', leaf);
      expect((await read(middle)).deletedAt).toBeNull();
      expect([await done(middle), await done(root)]).toEqual([false, false]);
    });

    it('counts a deep open task in its space today', async () => {
      const { leaf } = await chain();
      expect(leaf).toBeTruthy();
      const [space] = (await new SpacesService(db).list('u1', today)).filter((row) => row.id === spaces.u1);
      expect(space.openToday).toBe(3);
    });
  });

  describe('createManySubtasks', () => {
    const items = (...titles: string[]) => titles.map((title) => ({ id: crypto.randomUUID(), title, subtasks: [] }));
    const subtaskTitles = async (parentId: string) => {
      const listed = await svc.list('u1', spaces.u1, { from: today, to: today, today });
      return listed.find((task) => task.id === parentId)?.subtasks.map((subtask) => subtask.title);
    };

    it('adds them in the pasted order, after existing subtasks', async () => {
      const p = await addParent();
      await addSub(p);
      const titles = Array.from({ length: 12 }, (_, index) => `s${index}`);
      await svc.createManySubtasks('u1', p, items(...titles));
      expect(await subtaskTitles(p)).toEqual(['s', ...titles]);
    });

    it('reopens a finished parent', async () => {
      const p = await addParent({ completedOn: today });
      await svc.createManySubtasks('u1', p, items('new'));
      expect((await read(p)).completedOn).toBeNull();
    });

    it('adds nested subtasks under a subtask', async () => {
      const p = await addParent();
      const sub = await addSub(p);
      const [item] = items('child');
      await svc.createManySubtasks('u1', sub, [{ ...item, subtasks: items('grandchild') }]);
      const [listed] = await svc.list('u1', spaces.u1, { from: today, to: today, today });
      expect(listed.subtasks[0].subtasks[0].title).toBe('child');
      expect(listed.subtasks[0].subtasks[0].subtasks[0].title).toBe('grandchild');
      expect(listed.subtasks[0].subtasks[0].subtasks[0].day).toBe(today);
    });

    it("refuses another user's task", async () => {
      const theirs = await addParent({ userId: 'u2' });
      await expect(svc.createManySubtasks('u1', theirs, items('x'))).rejects.toThrow(NotFoundException);
    });

    it('saves nothing if any of them fails', async () => {
      const p = await addParent();
      const [first] = items('a');
      await expect(svc.createManySubtasks('u1', p, [first, { ...first, title: 'same id' }])).rejects.toThrow();
      expect(await subtaskTitles(p)).toEqual([]);
    });
  });

  describe('reorder', () => {
    const titles = async () =>
      (await svc.list('u1', spaces.u1, { from: today, to: today, today })).map((t) => t.title);
    const addNamed = async (title: string) => {
      const [row] = await db
        .insert(tasks)
        .values({ userId: 'u1', spaceId: spaces.u1, title, plannedDay: today })
        .returning();
      return row.id;
    };

    it('saves a new order for top-level tasks', async () => {
      const a = await addNamed('a');
      const b = await addNamed('b');
      const c = await addNamed('c');
      await svc.reorder('u1', [c, a, b]);
      expect(await titles()).toEqual(['c', 'a', 'b']);
    });

    it('puts a task created afterwards at the end', async () => {
      const a = await addNamed('a');
      const b = await addNamed('b');
      await svc.reorder('u1', [b, a]);
      await svc.create('u1', { spaceId: spaces.u1, title: 'new', day: today });
      expect(await titles()).toEqual(['b', 'a', 'new']);
    });

    it('saves a new order for subtasks of one parent', async () => {
      const p = await addParent();
      const a = await addSub(p);
      const b = await addSub(p);
      await svc.reorder('u1', [b, a]);
      const [listed] = await svc.list('u1', spaces.u1, { from: today, to: today, today });
      expect(listed.subtasks.map((s) => s.id)).toEqual([b, a]);
    });

    it('a copy keeps the reordered subtask order', async () => {
      const p = await addParent();
      const a = await addSub(p);
      const b = await addSub(p);
      await db.update(tasks).set({ title: 'first' }).where(eq(tasks.id, b));
      await db.update(tasks).set({ title: 'second' }).where(eq(tasks.id, a));
      await svc.reorder('u1', [b, a]);
      await svc.copy('u1', p, today);
      const list = await svc.list('u1', spaces.u1, { from: today, to: today, today });
      expect(list[1].subtasks.map((s) => s.title)).toEqual(['first', 'second']);
    });

    it('refuses tasks that are not siblings', async () => {
      const p = await addParent();
      const a = await addSub(p);
      await expect(svc.reorder('u1', [p, a])).rejects.toThrow(BadRequestException);
    });

    it('refuses tasks from different spaces', async () => {
      const a = await addNamed('a');
      const other = await insertSpace(db, 'u1');
      const [b] = await db
        .insert(tasks)
        .values({ userId: 'u1', spaceId: other, title: 'b', plannedDay: today })
        .returning();
      await expect(svc.reorder('u1', [a, b.id])).rejects.toThrow(BadRequestException);
    });

    it("refuses another user's task and changes nothing", async () => {
      const a = await addNamed('a');
      const b = await addNamed('b');
      const foreign = await addParent({ userId: 'u2' });
      await expect(svc.reorder('u1', [b, foreign, a])).rejects.toThrow(NotFoundException);
      expect(await titles()).toEqual(['a', 'b']);
    });

    it('refuses a repeated id', async () => {
      const a = await addNamed('a');
      await expect(svc.reorder('u1', [a, a])).rejects.toThrow(BadRequestException);
    });
  });

  it('deleting a parent deletes subtasks', async () => {
    const p = await addParent();
    await addSub(p);
    await svc.remove('u1', p, today);
    expect(await svc.list('u1', spaces.u1, { from: today, to: today, today })).toEqual([]);
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
    expect((await svc.list('u1', spaces.u1, { from: today, to: today, today }))[0].finished).toBe(true);
  });
});
