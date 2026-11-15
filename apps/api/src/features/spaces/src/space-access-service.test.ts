import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { notebookPages, spaces, tasks, user } from '../../../shared/db/schema.ts';
import { createTestDb, insertFolder, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpaceAccessService } from './space-access-service.ts';

describe('SpaceAccessService', () => {
  let db: Db;
  let access: SpaceAccessService;

  const share = (spaceId: string, role: 'edit' | 'view', email = 'u2@example.com') =>
    insertShare(db, { spaceId, ownerId: 'u1', email, role });
  const insertTask = async (spaceId: string) => {
    const [row] = await db.insert(tasks).values({ userId: 'u1', spaceId, title: 'Task', plannedDay: '2026-11-15' }).returning();
    return row.id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    access = new SpaceAccessService(db);
  });

  describe('resolve', () => {
    it('gives the owner their own space', async () => {
      const space = await insertSpace(db, 'u1');
      await expect(access.resolve('u1', space, 'edit')).resolves.toEqual({ ownerId: 'u1', access: 'owner', spaceId: space });
    });

    it('hides a space that is not shared', async () => {
      const space = await insertSpace(db, 'u1');
      await expect(access.resolve('u2', space, 'view')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('hides a missing or deleted space', async () => {
      const deleted = await insertSpace(db, 'u1', { deletedAt: new Date() });
      await expect(access.resolve('u1', deleted, 'view')).rejects.toBeInstanceOf(NotFoundException);
      await expect(access.resolve('u1', crypto.randomUUID(), 'view')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a viewer view but not edit, matching a mixed-case account email', async () => {
      const space = await insertSpace(db, 'u1');
      await share(space, 'view', 'U2@Example.com '.trim().toLowerCase());
      await db.update(user).set({ email: 'U2@Example.com' }).where(eq(user.id, 'u2'));

      await expect(access.resolve('u2', space, 'view')).resolves.toEqual({ ownerId: 'u1', access: 'view', spaceId: space });
      await expect(access.resolve('u2', space, 'edit')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('covers a space added to a shared folder after the share', async () => {
      const folder = await insertFolder(db, 'u1');
      await share(folder, 'edit');
      const space = await insertSpace(db, 'u1', { parentId: folder });

      await expect(access.resolve('u2', space, 'edit')).resolves.toEqual({ ownerId: 'u1', access: 'edit', spaceId: space });
    });

    it('takes the best role when a folder and a space inside it are both shared', async () => {
      const folder = await insertFolder(db, 'u1');
      const space = await insertSpace(db, 'u1', { parentId: folder });
      await share(folder, 'view');
      await share(space, 'edit');

      await expect(access.resolve('u2', space, 'edit')).resolves.toMatchObject({ access: 'edit' });
      await expect(access.resolve('u2', folder, 'edit')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('never resolves a Vault inside a shared folder', async () => {
      const folder = await insertFolder(db, 'u1');
      const vault = await insertSpace(db, 'u1', { parentId: folder, tool: 'vault' });
      await share(folder, 'edit');

      await expect(access.resolve('u2', vault, 'view')).rejects.toBeInstanceOf(NotFoundException);
      await expect(access.resolve('u1', vault, 'view')).resolves.toMatchObject({ access: 'owner' });
    });

    it('hides a space whose folder was deleted', async () => {
      const folder = await insertFolder(db, 'u1');
      const space = await insertSpace(db, 'u1', { parentId: folder });
      await share(folder, 'edit');
      await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, folder));

      await expect(access.resolve('u2', space, 'view')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a share made before sign-up work once the account exists', async () => {
      const space = await insertSpace(db, 'u1');
      await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u3@example.com', role: 'view' });
      await insertUser(db, 'u3');

      await expect(access.resolve('u3', space, 'view')).resolves.toMatchObject({ ownerId: 'u1', access: 'view' });
    });
  });

  describe('resolveRow', () => {
    it('resolves through the row’s space', async () => {
      const space = await insertSpace(db, 'u1');
      await share(space, 'view');
      const task = await insertTask(space);

      await expect(access.resolveRow('u2', tasks, task, 'view')).resolves.toMatchObject({ ownerId: 'u1', access: 'view' });
      await expect(access.resolveRow('u2', tasks, task, 'edit')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('hides a missing row', async () => {
      await expect(access.resolveRow('u1', notebookPages, crypto.randomUUID(), 'view')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveRows', () => {
    it('resolves rows in shared spaces of one owner', async () => {
      const first = await insertSpace(db, 'u1');
      const second = await insertSpace(db, 'u1');
      await share(first, 'edit');
      await share(second, 'edit');
      const ids = [await insertTask(first), await insertTask(second)];

      await expect(access.resolveRows('u2', tasks, ids, 'edit')).resolves.toMatchObject({ ownerId: 'u1', access: 'edit' });
    });

    it('refuses when one row is in the owner’s private space', async () => {
      const shared = await insertSpace(db, 'u1');
      const privateSpace = await insertSpace(db, 'u1');
      await share(shared, 'edit');
      const ids = [await insertTask(shared), await insertTask(privateSpace)];

      await expect(access.resolveRows('u2', tasks, ids, 'view')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a missing row and rows of two owners', async () => {
      const mine = await insertSpace(db, 'u2');
      const theirs = await insertSpace(db, 'u1');
      await share(theirs, 'edit');
      const myTask = (await db.insert(tasks).values({ userId: 'u2', spaceId: mine, title: 'Mine', plannedDay: '2026-11-15' }).returning())[0].id;
      const theirTask = await insertTask(theirs);

      await expect(access.resolveRows('u2', tasks, [myTask, crypto.randomUUID()], 'view')).rejects.toBeInstanceOf(NotFoundException);
      await expect(access.resolveRows('u2', tasks, [myTask, theirTask], 'view')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('sharedWith', () => {
    it('lists a shared folder and its children, without a Vault or deleted child', async () => {
      const folder = await insertFolder(db, 'u1');
      const child = await insertSpace(db, 'u1', { parentId: folder });
      await insertSpace(db, 'u1', { parentId: folder, tool: 'vault' });
      await insertSpace(db, 'u1', { parentId: folder, deletedAt: new Date() });
      await share(folder, 'view');

      const rows = await access.sharedWith('u2');
      expect(rows.map((r) => [r.row.id, r.row.parentId, r.access, r.ownerName]).sort()).toEqual(
        [
          [folder, null, 'view', 'u1'],
          [child, folder, 'view', 'u1'],
        ].sort(),
      );
    });

    it('detaches a space shared on its own from its unshared folder', async () => {
      const folder = await insertFolder(db, 'u1');
      const space = await insertSpace(db, 'u1', { parentId: folder });
      await share(space, 'edit');

      expect(await access.sharedWith('u2')).toEqual([
        { row: expect.objectContaining({ id: space, parentId: null }), access: 'edit', ownerName: 'u1' },
      ]);
    });

    it('keeps the best role once when a folder and a space inside are both shared', async () => {
      const folder = await insertFolder(db, 'u1');
      const space = await insertSpace(db, 'u1', { parentId: folder });
      await share(folder, 'view');
      await share(space, 'edit');

      const rows = await access.sharedWith('u2');
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.row.id === space)?.access).toBe('edit');
    });

    it('leaves out spaces under a deleted folder and the user’s own spaces', async () => {
      const folder = await insertFolder(db, 'u1');
      await insertSpace(db, 'u1', { parentId: folder });
      await share(folder, 'edit');
      await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, folder));
      const own = await insertSpace(db, 'u2');
      await insertShare(db, { spaceId: own, ownerId: 'u2', email: 'u2@example.com', role: 'edit' });

      expect(await access.sharedWith('u2')).toEqual([]);
    });
  });
});
