import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, max, min } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { notebookPages, spaces } from '../../../shared/db/schema.ts';

type PageRow = typeof notebookPages.$inferSelect;

export type PageDto = Pick<PageRow, 'id' | 'title' | 'content'> & { createdAt: string };

const PAGE_TOOLS = ['notebook', 'book'] as const;

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
    const updated = await this.db
      .update(notebookPages)
      .set({ ...changes, updatedAt: new Date() })
      .where(this.ownedPage(userId, id))
      .returning({ id: notebookPages.id });
    if (updated.length === 0) throw new NotFoundException('Page not found');
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
