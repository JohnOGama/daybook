import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { notebookPages, spaces } from '../../../shared/db/schema.ts';

type PageRow = typeof notebookPages.$inferSelect;

export type PageDto = Pick<PageRow, 'id' | 'title' | 'content'> & { createdAt: string };

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
  async list(userId: string, spaceId: string): Promise<PageDto[]> {
    await this.assertNotebook(userId, spaceId);
    const rows = await this.db
      .select()
      .from(notebookPages)
      .where(
        and(eq(notebookPages.userId, userId), eq(notebookPages.spaceId, spaceId), isNull(notebookPages.deletedAt)),
      )
      .orderBy(desc(notebookPages.createdAt), desc(notebookPages.id));
    return rows.map(toDto);
  }

  async create(userId: string, input: { id: string; spaceId: string }): Promise<void> {
    await this.assertNotebook(userId, input.spaceId);
    await this.db.insert(notebookPages).values({ ...input, userId });
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

  private async assertNotebook(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(
        and(
          eq(spaces.id, spaceId),
          eq(spaces.userId, userId),
          eq(spaces.tool, 'notebook'),
          isNull(spaces.deletedAt),
        ),
      );
    if (!space) throw new NotFoundException('Notebook not found');
  }
}
