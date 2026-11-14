import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { notebookPages, spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpacesService } from '../../spaces/src/spaces-service.ts';
import { TrashService } from '../../trash/src/trash-service.ts';
import { NotebookService } from './notebook-service.ts';

const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] };

describe('NotebookService', () => {
  let db: Db;
  let svc: NotebookService;
  let notebook: string;
  let theirNotebook: string;

  const addNotebook = async (userId: string) => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Book', tool: 'notebook' }).returning();
    return row.id;
  };
  const addPage = async () => {
    const id = crypto.randomUUID();
    await svc.create('u1', { id, spaceId: notebook });
    return id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new NotebookService(db);
    notebook = await addNotebook('u1');
    theirNotebook = await addNotebook('u2');
  });

  it('starts a page blank and saves its title and content separately', async () => {
    const id = await addPage();
    expect((await svc.list('u1', notebook))[0]).toMatchObject({ id, title: '', content: null });
    await svc.update('u1', id, { title: 'Plan' });
    await svc.update('u1', id, { content: doc });
    expect((await svc.list('u1', notebook))[0]).toMatchObject({ title: 'Plan', content: doc });
  });

  it('keeps a copy of a page before it is edited, at most one per ten minutes, and one more on request', async () => {
    const para = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    const id = await addPage();
    await svc.update('u1', id, { content: para('one') });
    expect(await svc.listVersions('u1', id)).toEqual([]);
    await svc.update('u1', id, { content: para('two') });
    await svc.update('u1', id, { content: para('three') });
    await svc.update('u1', id, { title: 'Plan' });
    const [first] = await svc.listVersions('u1', id);
    expect((await svc.getVersion('u1', id, first.id)).content).toEqual(para('one'));

    await svc.checkpoint('u1', id);
    await svc.checkpoint('u1', id);
    const versions = await svc.listVersions('u1', id);
    expect(versions).toHaveLength(2);
    expect((await svc.getVersion('u1', id, versions[0].id)).content).toEqual(para('three'));

    expect(await svc.listVersions('u2', id)).toEqual([]);
    await expect(svc.getVersion('u2', id, first.id)).rejects.toThrow(NotFoundException);
    await expect(svc.checkpoint('u2', id)).rejects.toThrow(NotFoundException);
    await expect(svc.spaceOf('u2', id)).rejects.toThrow(NotFoundException);
    expect(await svc.spaceOf('u1', id)).toBe(notebook);
  });

  it('lists the newest page first', async () => {
    const older = crypto.randomUUID();
    await db.insert(notebookPages).values({ id: older, userId: 'u1', spaceId: notebook, createdAt: new Date(0) });
    const newer = await addPage();
    expect((await svc.list('u1', notebook)).map((page) => page.id)).toEqual([newer, older]);
  });

  it('keeps a dragged order and still adds new pages on top', async () => {
    const older = crypto.randomUUID();
    await db.insert(notebookPages).values({ id: older, userId: 'u1', spaceId: notebook, title: 'Old' });
    const one = await addPage();
    const two = await addPage();
    await svc.reorder('u1', notebook, [one, older, two]);
    const three = await addPage();
    expect((await svc.list('u1', notebook)).map((page) => page.id)).toEqual([three, one, older, two]);
  });

  it('hides a deleted page and refuses to edit it', async () => {
    const id = await addPage();
    await svc.remove('u1', id);
    expect(await svc.list('u1', notebook)).toEqual([]);
    await expect(svc.update('u1', id, { title: 'x' })).rejects.toThrow(NotFoundException);
  });

  it("keeps people out of each other's notebooks", async () => {
    const id = await addPage();
    await expect(svc.list('u2', notebook)).rejects.toThrow(NotFoundException);
    await expect(svc.create('u1', { id: crypto.randomUUID(), spaceId: theirNotebook })).rejects.toThrow(NotFoundException);
    await expect(svc.update('u2', id, { title: 'x' })).rejects.toThrow(NotFoundException);
    await expect(svc.remove('u2', id)).rejects.toThrow(NotFoundException);
  });

  it('only keeps pages in a Notebook space', async () => {
    const listSpace = await insertSpace(db, 'u1');
    await expect(svc.create('u1', { id: crypto.randomUUID(), spaceId: listSpace })).rejects.toThrow(NotFoundException);
  });

  it('puts a deleted page in Trash and restores it, with its notebook', async () => {
    const trash = new TrashService(db);
    const id = await addPage();
    await svc.update('u1', id, { title: 'Plan' });
    await svc.remove('u1', id);
    await db.update(spaces).set({ deletedAt: new Date() }).where(eq(spaces.id, notebook));
    expect(await trash.list('u1')).toContainEqual(expect.objectContaining({ id, type: 'page', title: 'Plan', location: 'Book' }));
    await expect(trash.restorePage('u2', id)).rejects.toThrow(NotFoundException);
    await trash.restorePage('u1', id);
    expect((await svc.list('u1', notebook)).map((page) => page.id)).toEqual([id]);
  });

  it('duplicating a notebook copies its pages but not deleted ones', async () => {
    const kept = await addPage();
    await svc.update('u1', kept, { title: 'Keep', content: doc });
    await svc.remove('u1', await addPage());
    const copy = await new SpacesService(db).duplicate('u1', notebook);
    const pages = await db.select().from(notebookPages).where(eq(notebookPages.spaceId, copy.id));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ title: 'Keep', content: doc, userId: 'u1' });
    expect(pages[0].id).not.toBe(kept);
  });

  describe('book chapters', () => {
    let book: string;
    const addChapter = async (title: string) => {
      const id = crypto.randomUUID();
      await svc.create('u1', { id, spaceId: book });
      await svc.update('u1', id, { title });
      return id;
    };
    const titles = async (spaceId = book) => (await svc.list('u1', spaceId)).map((page) => page.title);

    beforeEach(async () => {
      const [row] = await db.insert(spaces).values({ userId: 'u1', kind: 'space', title: 'Novel', tool: 'book' }).returning();
      book = row.id;
    });

    it('lists chapters in the order they were added', async () => {
      for (const title of ['One', 'Two', 'Three']) await addChapter(title);
      expect(await titles()).toEqual(['One', 'Two', 'Three']);
    });

    it('keeps a new order and adds later chapters at the end', async () => {
      const [one, two, three] = [await addChapter('One'), await addChapter('Two'), await addChapter('Three')];
      await svc.reorder('u1', book, [three, one, two]);
      await addChapter('Four');
      expect(await titles()).toEqual(['Three', 'One', 'Two', 'Four']);
    });

    it("refuses to reorder another book's or another person's chapters", async () => {
      const mine = await addChapter('One');
      const page = await addPage();
      await expect(svc.reorder('u1', book, [mine, page])).rejects.toThrow(NotFoundException);
      await expect(svc.reorder('u2', book, [mine])).rejects.toThrow(NotFoundException);
    });

    it('duplicating a book keeps its chapter order', async () => {
      const [one, two] = [await addChapter('One'), await addChapter('Two')];
      await svc.reorder('u1', book, [two, one]);
      const copy = await new SpacesService(db).duplicate('u1', book);
      expect(await titles(copy.id)).toEqual(['Two', 'One']);
    });
  });
});
