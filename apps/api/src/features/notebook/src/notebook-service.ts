import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, max, min, notInArray } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { notebookPages, notebookPageVersions, spaces } from '../../../shared/db/schema.ts';

type PageRow = typeof notebookPages.$inferSelect;

export type PageDto = Pick<PageRow, 'id' | 'title' | 'content'> & { createdAt: string };

export type VersionDto = { id: string; createdAt: string };

const PAGE_TOOLS = ['notebook', 'book'] as const;
const VERSION_GAP_MS = 10 * 60 * 1000;
const VERSIONS_KEPT = 50;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const toDto = ({ id, title, content, createdAt }: PageRow): PageDto => ({
  id,
  title,
  content,
  createdAt: createdAt.toISOString(),
});

@Injectable()
export class NotebookService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // ponytail: returns every page's full content; list titles separately if notebooks get large
  // Pages list in their set order. Notebook pages from before reordering have no position and list last, newest first.
  async list(userId: string, spaceId: string): Promise<PageDto[]> {
    await this.assertPageSpace(userId, spaceId);
    const rows = await this.db
      .select()
      .from(notebookPages)
      .where(
        and(eq(notebookPages.userId, userId), eq(notebookPages.spaceId, spaceId), isNull(notebookPages.deletedAt)),
      )
      .orderBy(asc(notebookPages.position), desc(notebookPages.createdAt), desc(notebookPages.id));
    return rows.map(toDto);
  }

  async create(userId: string, input: { id: string; spaceId: string }): Promise<void> {
    const tool = await this.assertPageSpace(userId, input.spaceId);
    const position = await this.edgePosition(input.spaceId, tool === 'book' ? 'end' : 'start');
    await this.db.insert(notebookPages).values({ ...input, userId, position });
  }

  async reorder(userId: string, spaceId: string, ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each chapter can appear only once');
    await this.assertPageSpace(userId, spaceId);
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: notebookPages.id })
        .from(notebookPages)
        .where(and(eq(notebookPages.spaceId, spaceId), eq(notebookPages.userId, userId), inArray(notebookPages.id, ids)));
      if (rows.length !== ids.length) throw new NotFoundException('Chapter not found');
      for (const [position, id] of ids.entries()) {
        await tx.update(notebookPages).set({ position }).where(eq(notebookPages.id, id));
      }
    });
  }

  async update(
    userId: string,
    id: string,
    changes: { title?: string; content?: Record<string, unknown> },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [page] = await tx.select().from(notebookPages).where(this.ownedPage(userId, id));
      if (!page) throw new NotFoundException('Page not found');
      if (changes.content) await this.keepVersion(tx, page, VERSION_GAP_MS);
      await tx.update(notebookPages).set({ ...changes, updatedAt: new Date() }).where(eq(notebookPages.id, id));
    });
  }

  // Keeps a copy of the page as it is saved right now, for a restore or any other sweeping change.
  async checkpoint(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [page] = await tx.select().from(notebookPages).where(this.ownedPage(userId, id));
      if (!page) throw new NotFoundException('Page not found');
      await this.keepVersion(tx, page, 0);
    });
  }

  async spaceOf(userId: string, id: string): Promise<string> {
    const [page] = await this.db.select({ spaceId: notebookPages.spaceId }).from(notebookPages).where(this.ownedPage(userId, id));
    if (!page) throw new NotFoundException('Page not found');
    return page.spaceId;
  }

  async listVersions(userId: string, pageId: string): Promise<VersionDto[]> {
    const rows = await this.db
      .select({ id: notebookPageVersions.id, createdAt: notebookPageVersions.createdAt })
      .from(notebookPageVersions)
      .where(and(eq(notebookPageVersions.pageId, pageId), eq(notebookPageVersions.userId, userId)))
      .orderBy(desc(notebookPageVersions.createdAt), desc(notebookPageVersions.id));
    return rows.map(({ id, createdAt }) => ({ id, createdAt: createdAt.toISOString() }));
  }

  async getVersion(userId: string, pageId: string, versionId: string): Promise<VersionDto & { content: Record<string, unknown> }> {
    const [row] = await this.db
      .select()
      .from(notebookPageVersions)
      .where(and(eq(notebookPageVersions.id, versionId), eq(notebookPageVersions.pageId, pageId), eq(notebookPageVersions.userId, userId)));
    if (!row) throw new NotFoundException('Version not found');
    return { id: row.id, createdAt: row.createdAt.toISOString(), content: row.content };
  }

  // Copies the page's saved content into its history, unless the newest copy is younger than `gapMs` or identical.
  private async keepVersion(tx: Tx, page: PageRow, gapMs: number): Promise<void> {
    if (!page.content) return;
    const [newest] = await tx
      .select()
      .from(notebookPageVersions)
      .where(eq(notebookPageVersions.pageId, page.id))
      .orderBy(desc(notebookPageVersions.createdAt), desc(notebookPageVersions.id))
      .limit(1);
    if (newest && Date.now() - newest.createdAt.getTime() < gapMs) return;
    if (newest && JSON.stringify(newest.content) === JSON.stringify(page.content)) return;
    await tx.insert(notebookPageVersions).values({ pageId: page.id, userId: page.userId, content: page.content });
    const kept = await tx
      .select({ id: notebookPageVersions.id })
      .from(notebookPageVersions)
      .where(eq(notebookPageVersions.pageId, page.id))
      .orderBy(desc(notebookPageVersions.createdAt), desc(notebookPageVersions.id))
      .limit(VERSIONS_KEPT);
    await tx.delete(notebookPageVersions).where(
      and(eq(notebookPageVersions.pageId, page.id), notInArray(notebookPageVersions.id, kept.map((version) => version.id))),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .update(notebookPages)
      .set({ deletedAt: new Date() })
      .where(this.ownedPage(userId, id))
      .returning({ id: notebookPages.id });
    if (deleted.length === 0) throw new NotFoundException('Page not found');
  }

  private ownedPage(userId: string, id: string) {
    return and(eq(notebookPages.id, id), eq(notebookPages.userId, userId), isNull(notebookPages.deletedAt));
  }

  // Book chapters go after the last one; notebook pages go above the first.
  private async edgePosition(spaceId: string, edge: 'start' | 'end'): Promise<number> {
    const [{ first, last }] = await this.db
      .select({ first: min(notebookPages.position), last: max(notebookPages.position) })
      .from(notebookPages)
      .where(eq(notebookPages.spaceId, spaceId));
    return edge === 'end' ? (last ?? -1) + 1 : (first ?? 0) - 1;
  }

  private async assertPageSpace(userId: string, spaceId: string): Promise<(typeof PAGE_TOOLS)[number]> {
    const [space] = await this.db
      .select({ tool: spaces.tool })
      .from(spaces)
      .where(
        and(
          eq(spaces.id, spaceId),
          eq(spaces.userId, userId),
          inArray(spaces.tool, [...PAGE_TOOLS]),
          isNull(spaces.deletedAt),
        ),
      );
    if (!space) throw new NotFoundException('Notebook not found');
    return space.tool as (typeof PAGE_TOOLS)[number];
  }
}
