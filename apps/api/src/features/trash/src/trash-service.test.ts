import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { tasks, vaultItems } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { SpacesService } from '../../spaces/src/spaces-service.ts';
import { TasksService } from '../../tasks/src/tasks-service.ts';
import { TrashService } from './trash-service.ts';

const today = '2026-11-09';
const range = { from: today, to: today, today };

describe('TrashService', () => {
  let db: Db;
  let trash: TrashService;
  let spaces: SpacesService;
  let taskService: TasksService;
  let spaceId: string;

  const addTask = async (title: string, fields: { completedOn?: string; spaceId?: string } = {}) => {
    const [row] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId, title, plannedDay: today, ...fields })
      .returning();
    return row.id;
  };
  const addSub = async (parentId: string, title: string, completedOn?: string) => {
    const [row] = await db.insert(tasks).values({ userId: 'u1', spaceId, title, parentId, completedOn }).returning();
    return row.id;
  };
  const visible = async (id = spaceId) => (await taskService.list('u1', id, range)).map((t) => t.title);

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    trash = new TrashService(db);
    spaces = new SpacesService(db);
    taskService = new TasksService(db);
    spaceId = (await spaces.create('u1', { kind: 'space', title: 'Home', tool: 'list' })).id;
  });

  describe('list', () => {
    it('starts empty', async () => {
      expect(await trash.list('u1')).toEqual([]);
    });

    it('shows a deleted task and where it came from', async () => {
      const id = await addTask('Buy milk');
      await taskService.remove('u1', id, today);
      expect(await trash.list('u1')).toMatchObject([{ id, type: 'task', title: 'Buy milk', location: 'Home' }]);
    });

    it('shows the parent for a deleted subtask', async () => {
      const parent = await addTask('Parent');
      const sub = await addSub(parent, 'Child');
      await taskService.remove('u1', sub, today);
      expect((await trash.list('u1'))[0]).toMatchObject({ type: 'subtask', location: 'Home / Parent' });
    });

    it('shows the folder for a task in a space inside a folder', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      const id = await addTask('T', { spaceId: inside.id });
      await taskService.remove('u1', id, today);
      expect((await trash.list('u1'))[0].location).toBe('Team / In');
    });

    it('shows deleted spaces and folders', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      await spaces.remove('u1', inside.id);
      await spaces.remove('u1', folder.id);
      const items = await trash.list('u1');
      expect(items.find((i) => i.id === inside.id)).toMatchObject({ type: 'space', location: 'Team' });
      expect(items.find((i) => i.id === folder.id)).toMatchObject({ type: 'folder', location: null });
    });

    it('does not list a task that only went with its parent', async () => {
      const parent = await addTask('Parent');
      await addSub(parent, 'Child');
      await taskService.remove('u1', parent, today);
      expect((await trash.list('u1')).map((i) => i.title)).toEqual(['Parent']);
    });

    it('puts the most recently deleted first', async () => {
      const a = await addTask('a');
      const b = await addTask('b');
      await taskService.remove('u1', a, today);
      await db.update(tasks).set({ deletedAt: new Date('2026-11-01T00:00:00Z') }).where(eq(tasks.id, a));
      await taskService.remove('u1', b, today);
      expect((await trash.list('u1')).map((i) => i.title)).toEqual(['b', 'a']);
    });

    it("never shows another user's items", async () => {
      const id = await addTask('mine');
      await taskService.remove('u1', id, today);
      expect(await trash.list('u2')).toEqual([]);
    });
  });

  describe('restoreTask', () => {
    it('puts a task and its subtasks back and leaves the trash', async () => {
      const parent = await addTask('Parent');
      await addSub(parent, 'Child');
      await taskService.remove('u1', parent, today);
      expect(await visible()).toEqual([]);
      await trash.restoreTask('u1', parent);
      expect(await visible()).toEqual(['Parent']);
      expect((await taskService.list('u1', spaceId, range))[0].subtasks.map((s) => s.title)).toEqual(['Child']);
      expect(await trash.list('u1')).toEqual([]);
    });

    it('keeps a separately deleted subtask in the trash when its parent is restored', async () => {
      const parent = await addTask('Parent');
      const sub = await addSub(parent, 'Child');
      await taskService.remove('u1', sub, today);
      await taskService.remove('u1', parent, today);
      await trash.restoreTask('u1', parent);
      expect((await taskService.list('u1', spaceId, range))[0].subtasks).toEqual([]);
      expect((await trash.list('u1')).map((i) => i.id)).toEqual([sub]);
    });

    it('restoring an unfinished subtask reopens its finished parent', async () => {
      const parent = await addTask('Parent');
      const done = await addSub(parent, 'Done', today);
      const open = await addSub(parent, 'Open');
      await taskService.remove('u1', open, today);
      await taskService.setFinished('u1', done, true, today);
      expect((await taskService.list('u1', spaceId, range))[0].finished).toBe(true);
      await trash.restoreTask('u1', open);
      expect((await taskService.list('u1', spaceId, range))[0].finished).toBe(false);
    });

    it('restoring a subtask brings back its deleted parent', async () => {
      const parent = await addTask('Parent');
      const sub = await addSub(parent, 'Child');
      await taskService.remove('u1', sub, today);
      await taskService.remove('u1', parent, today);
      await trash.restoreTask('u1', sub);
      expect((await taskService.list('u1', spaceId, range))[0].subtasks.map((s) => s.title)).toEqual(['Child']);
    });

    it('restoring a task brings back its deleted space and folder', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      const id = await addTask('T', { spaceId: inside.id });
      await taskService.remove('u1', id, today);
      await spaces.remove('u1', inside.id);
      await spaces.remove('u1', folder.id);
      await trash.restoreTask('u1', id);
      const listed = await spaces.list('u1', today);
      expect(listed.find((s) => s.id === inside.id)?.parentId).toBe(folder.id);
      expect(listed.some((s) => s.id === folder.id)).toBe(true);
      expect(await visible(inside.id)).toEqual(['T']);
    });

    it('refuses a task that is not in the trash', async () => {
      const id = await addTask('T');
      await expect(trash.restoreTask('u1', id)).rejects.toThrow(NotFoundException);
    });

    it("refuses another user's task", async () => {
      const id = await addTask('T');
      await taskService.remove('u1', id, today);
      await expect(trash.restoreTask('u2', id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restoreSpace', () => {
    it('puts a space back in its folder with its tasks', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      await addTask('T', { spaceId: inside.id });
      await spaces.remove('u1', inside.id);
      await trash.restoreSpace('u1', inside.id);
      expect((await spaces.list('u1', today)).find((s) => s.id === inside.id)?.parentId).toBe(folder.id);
      expect(await visible(inside.id)).toEqual(['T']);
    });

    it('restoring a space brings back its deleted folder', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      await spaces.remove('u1', folder.id);
      await trash.restoreSpace('u1', folder.id);
      expect((await spaces.list('u1', today)).map((s) => s.id)).toContain(inside.id);
    });

    it('restoring a folder leaves a separately deleted space in the trash', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      await spaces.remove('u1', inside.id);
      await spaces.remove('u1', folder.id);
      await trash.restoreSpace('u1', folder.id);
      expect((await spaces.list('u1', today)).map((s) => s.id)).not.toContain(inside.id);
      expect((await trash.list('u1')).map((i) => i.id)).toEqual([inside.id]);
    });

    it("refuses another user's space", async () => {
      await spaces.remove('u1', spaceId);
      await expect(trash.restoreSpace('u2', spaceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('vault items', () => {
    const iv = Buffer.alloc(12, 1).toString('base64');
    const ciphertext = Buffer.alloc(32, 2).toString('base64');
    let vaultSpaceId: string;
    let itemId: string;

    beforeEach(async () => {
      vaultSpaceId = (await spaces.create('u1', { kind: 'space', title: 'Safe', tool: 'vault' })).id;
      itemId = crypto.randomUUID();
      await db.insert(vaultItems).values({ id: itemId, userId: 'u1', spaceId: vaultSpaceId, iv, ciphertext, deletedAt: new Date() });
    });

    it('lists a deleted vault item without a readable title', async () => {
      expect(await trash.list('u1')).toMatchObject([
        { id: itemId, type: 'vault-item', title: 'Encrypted item', location: 'Safe', payload: { iv, ciphertext } },
      ]);
    });

    it('restores a vault item and its space', async () => {
      await spaces.remove('u1', vaultSpaceId);
      await trash.restoreVaultItem('u1', itemId);
      const [row] = await db.select().from(vaultItems).where(eq(vaultItems.id, itemId));
      expect(row.deletedAt).toBeNull();
      expect((await spaces.list('u1', today)).map((space) => space.id)).toContain(vaultSpaceId);
    });

    it("refuses another user's vault item", async () => {
      await expect(trash.restoreVaultItem('u2', itemId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('hidden while deleted', () => {
    it('a deleted task is not counted on its space', async () => {
      const id = await addTask('T');
      await taskService.remove('u1', id, today);
      expect((await spaces.list('u1', today))[0].openToday).toBe(0);
    });

    it('subtasks of a deleted parent are not counted', async () => {
      const parent = await addTask('Parent');
      await addSub(parent, 'Child');
      await taskService.remove('u1', parent, today);
      expect((await spaces.list('u1', today))[0].openToday).toBe(0);
    });

    it('a deleted task cannot be changed', async () => {
      const id = await addTask('T');
      await taskService.remove('u1', id, today);
      await expect(taskService.update('u1', id, { title: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('spaces inside a deleted folder are hidden', async () => {
      const folder = await spaces.create('u1', { kind: 'folder', title: 'Team' });
      const inside = await spaces.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      await spaces.remove('u1', folder.id);
      expect((await spaces.list('u1', today)).map((s) => s.id)).not.toContain(inside.id);
    });

    it('a task ticked closed ignores a deleted subtask', async () => {
      const parent = await addTask('Parent');
      const sub = await addSub(parent, 'Child');
      await taskService.remove('u1', sub, today);
      await taskService.setFinished('u1', parent, true, today);
      await trash.restoreTask('u1', sub);
      expect((await taskService.list('u1', spaceId, range))[0].finished).toBe(false);
    });

    it('duplicating a task leaves out deleted subtasks', async () => {
      const parent = await addTask('Parent');
      const sub = await addSub(parent, 'Gone');
      await addSub(parent, 'Kept');
      await taskService.remove('u1', sub, today);
      await taskService.copy('u1', parent, today);
      const copy = (await taskService.list('u1', spaceId, range))[1];
      expect(copy.subtasks.map((s) => s.title)).toEqual(['Kept']);
    });

    it('duplicating a space leaves out deleted tasks', async () => {
      const id = await addTask('Gone');
      await addTask('Kept');
      await taskService.remove('u1', id, today);
      const copy = await spaces.duplicate('u1', spaceId);
      expect(await visible(copy.id)).toEqual(['Kept']);
    });
  });
});
