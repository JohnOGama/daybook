import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { TrashService } from '../../trash/src/trash-service.ts';
import { SpaceAccessService } from './space-access-service.ts';
import { SpaceGroupsService } from './space-groups-service.ts';
import { SpacesService } from './spaces-service.ts';

const today = '2026-11-20';

describe('SpaceGroupsService', () => {
  let db: Db;
  let groups: SpaceGroupsService;
  let spaces: SpacesService;

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    groups = new SpaceGroupsService(db);
    spaces = new SpacesService(db, new SpaceAccessService(db), groups);
  });

  it('starts everyone with one "Spaces" group, made once', async () => {
    const [first] = await groups.list('u1');
    expect(first.title).toBe('Spaces');
    expect(await groups.list('u1')).toEqual([first]);
  });

  it('puts new top-level items in the first group, or the one asked for; a space in a folder has no group', async () => {
    const work = await groups.create('u1', { title: 'Work' });
    const [main] = await groups.list('u1');
    const home = await spaces.create('u1', { kind: 'space', title: 'Home', tool: 'list' });
    const folder = await spaces.create('u1', { kind: 'folder', title: 'Clients', groupId: work.id });
    const inside = await spaces.create('u1', { kind: 'space', title: 'Board', tool: 'list', parentId: folder.id });
    expect([home.groupId, folder.groupId, inside.groupId]).toEqual([main.id, work.id, null]);
  });

  it("won't use someone else's group", async () => {
    const theirs = await groups.create('u2', { title: 'Theirs' });
    await expect(spaces.create('u1', { kind: 'space', title: 'x', tool: 'list', groupId: theirs.id })).rejects.toBeInstanceOf(NotFoundException);
    await expect(groups.rename('u1', theirs.id, 'Mine')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renames, and moves a top-level item between groups', async () => {
    const [main] = await groups.list('u1');
    const work = await groups.create('u1', { title: 'Work' });
    await groups.rename('u1', main.id, 'Personal');
    expect((await groups.list('u1')).map((group) => group.title)).toEqual(['Personal', 'Work']);

    const space = await spaces.create('u1', { kind: 'space', title: 'Home', tool: 'list', groupId: main.id });
    await spaces.moveToGroup('u1', space.id, work.id);
    expect((await spaces.list('u1', today))[0].groupId).toBe(work.id);
  });

  it('a space taken out of a folder lands in the folder\'s group', async () => {
    const work = await groups.create('u1', { title: 'Work' });
    const folder = await spaces.create('u1', { kind: 'folder', title: 'Clients', groupId: work.id });
    const inside = await spaces.create('u1', { kind: 'space', title: 'Board', tool: 'list', parentId: folder.id });
    await spaces.move('u1', inside.id, null);
    expect((await spaces.list('u1', today)).find((space) => space.id === inside.id)?.groupId).toBe(work.id);
  });

  it('deleting a group sends its top-level items to Trash, and restoring one brings the group back', async () => {
    const [main] = await groups.list('u1');
    const work = await groups.create('u1', { title: 'Work' });
    const kept = await spaces.create('u1', { kind: 'space', title: 'Home', tool: 'list', groupId: main.id });
    const gone = await spaces.create('u1', { kind: 'space', title: 'Client', tool: 'list', groupId: work.id });

    await groups.remove('u1', work.id);
    expect((await groups.list('u1')).map((group) => group.id)).toEqual([main.id]);
    expect((await spaces.list('u1', today)).map((space) => space.id)).toEqual([kept.id]);

    await new TrashService(db).restoreSpace('u1', gone.id);
    expect((await groups.list('u1')).map((group) => group.id)).toEqual([main.id, work.id]);
    expect((await spaces.list('u1', today)).find((space) => space.id === gone.id)?.groupId).toBe(work.id);
  });

  it('takes a space out of its folder into another group, at the spot asked for', async () => {
    const [main] = await groups.list('u1');
    const work = await groups.create('u1', { title: 'Work' });
    const folder = await spaces.create('u1', { kind: 'folder', title: 'Clients', groupId: main.id });
    const inside = await spaces.create('u1', { kind: 'space', title: 'Board', tool: 'list', parentId: folder.id });
    const a = await spaces.create('u1', { kind: 'space', title: 'A', tool: 'list', groupId: work.id });
    const b = await spaces.create('u1', { kind: 'space', title: 'B', tool: 'list', groupId: work.id });

    await spaces.moveToGroup('u1', inside.id, work.id, [a.id, inside.id, b.id]);
    const inWork = (await spaces.list('u1', today)).filter((space) => space.groupId === work.id);
    expect(inWork.map((space) => space.title)).toEqual(['A', 'Board', 'B']);
    expect(inWork[1].parentId).toBeNull();
  });

  it('reorders your groups, and only with all of them', async () => {
    const [main] = await groups.list('u1');
    const work = await groups.create('u1', { title: 'Work' });
    await groups.reorder('u1', [work.id, main.id]);
    expect((await groups.list('u1')).map((group) => group.title)).toEqual(['Work', 'Spaces']);
    await expect(groups.reorder('u1', [work.id])).rejects.toBeInstanceOf(BadRequestException);
    const [theirs] = await groups.list('u2');
    await expect(groups.reorder('u1', [work.id, theirs.id])).rejects.toBeInstanceOf(BadRequestException);
  });

  it("won't delete your only group", async () => {
    const [main] = await groups.list('u1');
    await expect(groups.remove('u1', main.id)).rejects.toBeInstanceOf(BadRequestException);
  });
});
