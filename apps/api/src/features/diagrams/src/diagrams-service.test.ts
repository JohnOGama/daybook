import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { diagrams, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { saveDiagramSchema } from './diagrams-schemas.ts';
import { DiagramsService } from './diagrams-service.ts';

describe('DiagramsService', () => {
  let db: Db;
  let svc: DiagramsService;
  let space: string;

  const addSpace = async (userId: string, tool: 'diagram' | 'jobs' = 'diagram') => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Shop database', tool }).returning();
    return row.id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new DiagramsService(db);
    space = await addSpace('u1');
  });

  it('starts empty', async () => {
    expect(await svc.load('u1', space)).toEqual({ dbml: '', positions: {}, updatedAt: null, version: 0 });
  });

  it('saves the text and positions, replacing what was there', async () => {
    expect(await svc.save('u1', space, { dbml: 'Table users { id int [pk] }', positions: { users: { x: 10, y: 20 } }, version: 0 })).toEqual({ version: 1 });
    expect(await svc.save('u1', space, { dbml: 'Table people { id int [pk] }', positions: { people: { x: 5, y: 6 } }, version: 1 })).toEqual({ version: 2 });
    const loaded = await svc.load('u1', space);
    expect(loaded).toMatchObject({ dbml: 'Table people { id int [pk] }', positions: { people: { x: 5, y: 6 } }, version: 2 });
    expect(loaded.updatedAt).toEqual(expect.any(String));
  });

  it('refuses a save made from an old version, including a second first save', async () => {
    await svc.save('u1', space, { dbml: 'Table mine {}', positions: {}, version: 0 });
    await expect(svc.save('u1', space, { dbml: 'Table theirs {}', positions: {}, version: 0 })).rejects.toThrow(ConflictException);
    await svc.save('u1', space, { dbml: 'Table next {}', positions: {}, version: 1 });
    await expect(svc.save('u1', space, { dbml: 'Table stale {}', positions: {}, version: 1 })).rejects.toThrow(ConflictException);
    expect(await svc.load('u1', space)).toMatchObject({ dbml: 'Table next {}', version: 2 });
  });

  it("keeps people out of each other's diagrams and out of other tools", async () => {
    await expect(svc.load('u2', space)).rejects.toThrow(NotFoundException);
    await expect(svc.save('u2', space, { dbml: '', positions: {}, version: 0 })).rejects.toThrow(NotFoundException);
    await expect(svc.load('u1', await addSpace('u1', 'jobs'))).rejects.toThrow(NotFoundException);
  });

  it('refuses text over 100,000 characters and positions that are not finite', () => {
    expect(saveDiagramSchema.safeParse({ spaceId: space, dbml: 'x'.repeat(100_001), positions: {}, version: 0 }).success).toBe(false);
    expect(saveDiagramSchema.safeParse({ spaceId: space, dbml: '', positions: { users: { x: Infinity, y: 0 } }, version: 0 }).success).toBe(false);
    expect(saveDiagramSchema.safeParse({ spaceId: space, dbml: 'Table a {}', positions: { a: { x: 1, y: 2 } }, version: 0 }).success).toBe(true);
    expect(saveDiagramSchema.safeParse({ spaceId: space, dbml: 'Table a {}', positions: {} }).success).toBe(false);
  });
});

describe('DiagramsService live document', () => {
  let db: Db;
  let svc: DiagramsService;
  let space: string;

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    svc = new DiagramsService(db);
    [{ id: space }] = await db.insert(spaces).values({ userId: 'u1', kind: 'space', title: 'Shop', tool: 'diagram' }).returning();
  });

  it('saveDoc then loadDoc round-trips text, positions and ydoc bytes', async () => {
    await svc.saveDoc('u1', space, { dbml: 'Table a {}', positions: { a: { x: 1, y: 2 } }, ydoc: new Uint8Array([1, 2, 3]) });
    const loaded = await svc.loadDoc(space);
    expect(loaded).toMatchObject({ ownerId: 'u1', dbml: 'Table a {}', positions: { a: { x: 1, y: 2 } } });
    expect(Buffer.from(loaded?.ydoc as Uint8Array)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('loadDoc returns empty text and null ydoc for a diagram space with no row', async () => {
    expect(await svc.loadDoc(space)).toEqual({ ownerId: 'u1', dbml: '', positions: {}, ydoc: null });
  });

  it('loadDoc returns null for a list space and for a deleted diagram space', async () => {
    const [list] = await db.insert(spaces).values({ userId: 'u1', kind: 'space', title: 'L', tool: 'list' }).returning();
    const [gone] = await db.insert(spaces).values({ userId: 'u1', kind: 'space', title: 'G', tool: 'diagram', deletedAt: new Date() }).returning();
    expect(await svc.loadDoc(list.id)).toBeNull();
    expect(await svc.loadDoc(gone.id)).toBeNull();
  });

  it('saveDoc stores the row under the owner and bumps version', async () => {
    const doc = { dbml: '', positions: {}, ydoc: new Uint8Array([0]) };
    await svc.saveDoc('u1', space, doc);
    expect((await svc.load('u1', space)).version).toBe(1);
    await svc.saveDoc('u1', space, doc);
    expect((await svc.load('u1', space)).version).toBe(2);
    const [row] = await db.select().from(diagrams);
    expect(row.userId).toBe('u1');
  });
});
