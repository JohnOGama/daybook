import { BadRequestException, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { diagrams, tasks } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpacesService } from './spaces-service.ts';

const today = '2026-11-09';

describe('SpacesService', () => {
  let db: Db;
  let svc: SpacesService;

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new SpacesService(db);
  });

  it('starts with no spaces', async () => {
    expect(await svc.list('u1', today)).toEqual([]);
  });

  it('creates a space with a tool and returns it', async () => {
    const created = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
    expect(created).toMatchObject({ kind: 'space', title: 'Home', tool: 'list', parentId: null, openToday: 0 });
    expect((await svc.list('u1', today)).map((s) => s.id)).toEqual([created.id]);
  });

  describe('reorder', () => {
    const add = (title: string, parentId?: string) => svc.create('u1', { kind: 'space', title, tool: 'list', parentId });

    it('saves the order and keeps later spaces at the end', async () => {
      const a = await add('a');
      const b = await add('b');
      const folder = await svc.create('u1', { kind: 'folder', title: 'f' });
      await svc.reorder('u1', [folder.id, b.id, a.id]);
      await add('c');
      expect((await svc.list('u1', today)).map((s) => s.title)).toEqual(['f', 'b', 'a', 'c']);
    });

    it('reorders spaces inside a folder', async () => {
      const folder = await svc.create('u1', { kind: 'folder', title: 'f' });
      const a = await add('a', folder.id);
      const b = await add('b', folder.id);
      await svc.reorder('u1', [b.id, a.id]);
      const inFolder = (await svc.list('u1', today)).filter((s) => s.parentId === folder.id);
      expect(inFolder.map((s) => s.title)).toEqual(['b', 'a']);
    });

    it('refuses spaces from different groups', async () => {
      const folder = await svc.create('u1', { kind: 'folder', title: 'f' });
      const inside = await add('a', folder.id);
      const outside = await add('b');
      await expect(svc.reorder('u1', [inside.id, outside.id])).rejects.toThrow(BadRequestException);
    });

    it("refuses another user's space", async () => {
      const mine = await add('a');
      const theirs = await svc.create('u2', { kind: 'space', title: 'b', tool: 'list' });
      await expect(svc.reorder('u1', [mine.id, theirs.id])).rejects.toThrow(NotFoundException);
    });

    it('refuses the same space twice', async () => {
      const a = await add('a');
      await expect(svc.reorder('u1', [a.id, a.id])).rejects.toThrow(BadRequestException);
    });
  });

  describe('carry over', () => {
    const yesterday = '2026-11-08';
    const add = (title: string, userId = 'u1') => svc.create(userId, { kind: 'space', title, tool: 'list' });
    const addTask = (userId: string, spaceId: string, plannedDay: string, completedOn?: string) =>
      db.insert(tasks).values({ userId, spaceId, title: 't', plannedDay, completedOn });

    it('is on for a new space', async () => {
      expect((await add('Home')).carryOver).toBe(true);
    });

    it('counts yesterday\'s open task today only while it is on', async () => {
      const space = await add('Home');
      await addTask('u1', space.id, yesterday);
      await addTask('u1', space.id, today);
      await addTask('u1', space.id, yesterday, yesterday);
      expect((await svc.list('u1', today))[0].openToday).toBe(2);
      await svc.setCarryOver('u1', space.id, false);
      expect((await svc.list('u1', today))[0]).toMatchObject({ carryOver: false, openToday: 1 });
    });

    it('is kept when a space is duplicated', async () => {
      const space = await add('Home');
      await svc.setCarryOver('u1', space.id, false);
      expect((await svc.duplicate('u1', space.id)).carryOver).toBe(false);
    });

    it("refuses another user's space", async () => {
      const theirs = await add('Theirs', 'u2');
      await expect(svc.setCarryOver('u1', theirs.id, false)).rejects.toThrow(NotFoundException);
      expect((await svc.list('u2', today))[0].carryOver).toBe(true);
    });

    it('only applies to a List space', async () => {
      const notebook = await svc.create('u1', { kind: 'space', title: 'Book', tool: 'notebook' });
      await expect(svc.setCarryOver('u1', notebook.id, false)).rejects.toThrow(NotFoundException);
    });
  });

  it('creates a folder with no tool', async () => {
    const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
    expect(folder).toMatchObject({ kind: 'folder', tool: null });
  });

  it('creates a space inside a folder', async () => {
    const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
    const inside = await svc.create('u1', { kind: 'space', title: 'Requests', tool: 'list', parentId: folder.id });
    expect(inside.parentId).toBe(folder.id);
  });

  it('moves a space into a folder, on to another, and back out, always last in its new group', async () => {
    const team = await svc.create('u1', { kind: 'folder', title: 'Team' });
    const home = await svc.create('u1', { kind: 'folder', title: 'Home' });
    await svc.create('u1', { kind: 'space', title: 'First', tool: 'list', parentId: home.id });
    const moving = await svc.create('u1', { kind: 'space', title: 'Moving', tool: 'list', parentId: team.id });
    const inGroup = async (parentId: string | null) =>
      (await svc.list('u1', today)).filter((space) => space.parentId === parentId).map((space) => space.title);

    await svc.move('u1', moving.id, home.id);
    expect(await inGroup(home.id)).toEqual(['First', 'Moving']);
    expect(await inGroup(team.id)).toEqual([]);
    await svc.move('u1', moving.id, null);
    expect(await inGroup(null)).toEqual(['Team', 'Home', 'Moving']);
  });

  it("refuses to move a folder, or to move a space into a space or another user's folder", async () => {
    const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
    const other = await svc.create('u1', { kind: 'folder', title: 'Other' });
    const space = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
    const target = await svc.create('u1', { kind: 'space', title: 'Target', tool: 'list' });
    const theirs = await svc.create('u2', { kind: 'folder', title: 'Theirs' });
    await expect(svc.move('u1', folder.id, other.id)).rejects.toThrow(NotFoundException);
    await expect(svc.move('u1', space.id, target.id)).rejects.toThrow(BadRequestException);
    await expect(svc.move('u1', space.id, theirs.id)).rejects.toThrow(NotFoundException);
    await expect(svc.move('u2', space.id, null)).rejects.toThrow(NotFoundException);
  });

  it('refuses a space inside a space', async () => {
    const space = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
    await expect(
      svc.create('u1', { kind: 'space', title: 'x', tool: 'list', parentId: space.id }),
    ).rejects.toThrow(BadRequestException);
  });

  it("refuses a space inside another user's folder", async () => {
    const folder = await svc.create('u2', { kind: 'folder', title: 'Team' });
    await expect(
      svc.create('u1', { kind: 'space', title: 'x', tool: 'list', parentId: folder.id }),
    ).rejects.toThrow(NotFoundException);
  });

  it("never lists another user's spaces", async () => {
    await svc.create('u2', { kind: 'space', title: 'Theirs', tool: 'list' });
    expect(await svc.list('u1', today)).toEqual([]);
  });

  it('creates a space with a client-chosen id', async () => {
    const id = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
    expect((await svc.create('u1', { id, kind: 'space', title: 'Home', tool: 'list' })).id).toBe(id);
  });

  describe('rename', () => {
    it('changes the title', async () => {
      const space = await svc.create('u1', { kind: 'space', title: 'Old', tool: 'list' });
      await svc.rename('u1', space.id, 'New');
      expect((await svc.list('u1', today))[0].title).toBe('New');
    });

    it("refuses another user's space", async () => {
      const theirs = await insertSpace(db, 'u2');
      await expect(svc.rename('u1', theirs, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicate', () => {
    const titlesIn = async (spaceId: string) =>
      (await db.select().from(tasks).where(eq(tasks.spaceId, spaceId))).map((t) => t.title).sort();

    it('copies the space into the same folder with its unfinished tasks and their subtasks', async () => {
      const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
      const source = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list', parentId: folder.id });
      const base = { userId: 'u1', spaceId: source.id };
      const [open] = await db.insert(tasks).values({ ...base, title: 'open', plannedDay: today }).returning();
      await db.insert(tasks).values({ ...base, title: 'child', parentId: open.id });
      await db.insert(tasks).values({ ...base, title: 'done', plannedDay: today, completedOn: today });

      const copy = await svc.duplicate('u1', source.id);

      expect(copy).toMatchObject({ title: 'Home (copy)', tool: 'list', parentId: folder.id });
      expect(await titlesIn(copy.id)).toEqual(['child', 'open']);
      expect(await titlesIn(source.id)).toEqual(['child', 'done', 'open']);
    });

    it('resets a finished subtask of an unfinished task', async () => {
      const source = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
      const base = { userId: 'u1', spaceId: source.id };
      const [open] = await db.insert(tasks).values({ ...base, title: 'open', plannedDay: today }).returning();
      await db.insert(tasks).values({ ...base, title: 'child', parentId: open.id, status: 'on_hold', completedOn: today });
      const copy = await svc.duplicate('u1', source.id);
      const rows = await db.select().from(tasks).where(eq(tasks.spaceId, copy.id));
      expect(rows.find((r) => r.title === 'child')).toMatchObject({ completedOn: null, status: 'todo' });
    });

    it('keeps the order of the tasks', async () => {
      const source = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
      const base = { userId: 'u1', spaceId: source.id, plannedDay: today };
      await db.insert(tasks).values({ ...base, title: 'second', position: 1 });
      await db.insert(tasks).values({ ...base, title: 'first', position: 0 });
      const copy = await svc.duplicate('u1', source.id);
      const rows = await db.select().from(tasks).where(eq(tasks.spaceId, copy.id)).orderBy(asc(tasks.position));
      expect(rows.map((r) => r.title)).toEqual(['first', 'second']);
    });

    it('uses a client-chosen id', async () => {
      const source = await svc.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
      const id = '6f1c1e5e-3a3e-4a39-9d6f-0a1d8f6b2c11';
      expect((await svc.duplicate('u1', source.id, id)).id).toBe(id);
    });

    it('refuses a folder', async () => {
      const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
      await expect(svc.duplicate('u1', folder.id)).rejects.toThrow(BadRequestException);
    });

    it("refuses another user's space", async () => {
      const theirs = await insertSpace(db, 'u2');
      await expect(svc.duplicate('u1', theirs)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hides a space, leaving other spaces alone and keeping its tasks', async () => {
      const doomed = await insertSpace(db, 'u1');
      const kept = await insertSpace(db, 'u1');
      await db.insert(tasks).values({ userId: 'u1', spaceId: doomed, title: 'kept in trash', plannedDay: today });
      await svc.remove('u1', doomed);
      expect((await svc.list('u1', today)).map((s) => s.id)).toEqual([kept]);
      expect(await db.select().from(tasks)).toHaveLength(1);
    });

    it('hides a folder and the spaces inside it', async () => {
      const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
      await svc.create('u1', { kind: 'space', title: 'In', tool: 'list', parentId: folder.id });
      await svc.remove('u1', folder.id);
      expect(await svc.list('u1', today)).toEqual([]);
    });

    it('refuses creating a space in a deleted folder', async () => {
      const folder = await svc.create('u1', { kind: 'folder', title: 'Team' });
      await svc.remove('u1', folder.id);
      await expect(
        svc.create('u1', { kind: 'space', title: 'x', tool: 'list', parentId: folder.id }),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuses another user's space and deletes nothing", async () => {
      const theirs = await insertSpace(db, 'u2');
      await expect(svc.remove('u1', theirs)).rejects.toThrow(NotFoundException);
      expect(await svc.list('u2', today)).toHaveLength(1);
    });
  });

  it('counts unfinished top-level tasks on today, including overdue ones but not subtasks', async () => {
    const spaceId = await insertSpace(db, 'u1');
    const base = { userId: 'u1', spaceId, title: 't' };
    const [parent] = await db.insert(tasks).values({ ...base, plannedDay: '2026-11-05' }).returning();
    await db.insert(tasks).values({ ...base, parentId: parent.id });
    await db.insert(tasks).values({ ...base, parentId: parent.id, completedOn: today });
    await db.insert(tasks).values({ ...base, plannedDay: today, completedOn: today });
    await db.insert(tasks).values({ ...base, plannedDay: '2026-11-20' });
    const [listed] = await svc.list('u1', today);
    expect(listed.openToday).toBe(1);
  });

  it('copies the diagram when a diagram space is duplicated', async () => {
    const source = await svc.create('u1', { kind: 'space', title: 'Shop', tool: 'diagram' });
    await db.insert(diagrams).values({ spaceId: source.id, userId: 'u1', dbml: 'Table users { id int }', positions: { users: { x: 1, y: 2 } } });
    const copy = await svc.duplicate('u1', source.id);
    const [copied] = await db.select().from(diagrams).where(eq(diagrams.spaceId, copy.id));
    expect(copied).toMatchObject({ dbml: 'Table users { id int }', positions: { users: { x: 1, y: 2 } } });
  });

  it('refuses to duplicate a jobs space', async () => {
    const jobsSpace = await svc.create('u1', { kind: 'space', title: 'J', tool: 'jobs' });
    await expect(svc.duplicate('u1', jobsSpace.id)).rejects.toThrow('A jobs space cannot be duplicated');
  });

  it('refuses to duplicate a vault space', async () => {
    const vault = await svc.create('u1', { kind: 'space', title: 'V', tool: 'vault' });
    await expect(svc.duplicate('u1', vault.id)).rejects.toThrow(BadRequestException);
  });

  it('does not count subtasks of a task planned for a future day', async () => {
    const spaceId = await insertSpace(db, 'u1');
    const base = { userId: 'u1', spaceId, title: 't' };
    const [parent] = await db.insert(tasks).values({ ...base, plannedDay: '2026-11-20' }).returning();
    await db.insert(tasks).values({ ...base, parentId: parent.id });
    expect((await svc.list('u1', today))[0].openToday).toBe(0);
  });
});
