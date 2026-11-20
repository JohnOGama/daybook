import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { notebookPages, spaceGroups, spaces, tasks, vaultItems } from '../../../shared/db/schema.ts';

export type TrashItem = {
  id: string;
  type: 'task' | 'subtask' | 'space' | 'folder' | 'page' | 'vault-item';
  title: string;
  location: string | null;
  deletedAt: string;
  payload?: { iv: string; ciphertext: string };
};

type SpaceRow = typeof spaces.$inferSelect;

const HIDDEN_TITLE = 'Hidden while its space is locked';

@Injectable()
export class TrashService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, canRead: (space: SpaceRow) => boolean = () => true): Promise<TrashItem[]> {
    const [allSpaces, deletedTasks, deletedPages, deletedVaultItems] = await Promise.all([
      this.db.select().from(spaces).where(eq(spaces.userId, userId)),
      this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNotNull(tasks.deletedAt))),
      this.db
        .select()
        .from(notebookPages)
        .where(and(eq(notebookPages.userId, userId), isNotNull(notebookPages.deletedAt))),
      this.db
        .select()
        .from(vaultItems)
        .where(and(eq(vaultItems.userId, userId), isNotNull(vaultItems.deletedAt))),
    ]);
    const spacesById = new Map(allSpaces.map((space) => [space.id, space]));
    const isHidden = (spaceId: string) => {
      const space = spacesById.get(spaceId);
      return space !== undefined && !canRead(space);
    };
    const parentIds = deletedTasks.flatMap((task) => (task.parentId ? [task.parentId] : []));
    const parentTitles = new Map<string, string>();
    for (const parentId of new Set(parentIds)) {
      const [parent] = await this.db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, parentId));
      if (parent) parentTitles.set(parentId, parent.title);
    }

    const spacePath = (spaceId: string) => {
      const space = spacesById.get(spaceId);
      const folder = space?.parentId ? spacesById.get(space.parentId) : undefined;
      return [folder?.title, space?.title].filter(Boolean).join(' / ');
    };

    const taskItems = deletedTasks.map((task): TrashItem => {
      const hidden = isHidden(task.spaceId);
      const parentTitle = task.parentId && !hidden ? parentTitles.get(task.parentId) : undefined;
      return {
        id: task.id,
        type: task.parentId ? 'subtask' : 'task',
        title: hidden ? HIDDEN_TITLE : task.title,
        location: [spacePath(task.spaceId), parentTitle].filter(Boolean).join(' / '),
        deletedAt: (task.deletedAt as Date).toISOString(),
      };
    });

    const spaceItems = allSpaces
      .filter((space) => space.deletedAt !== null)
      .map(
        (space): TrashItem => ({
          id: space.id,
          type: space.kind,
          title: space.title,
          location: space.parentId ? (spacesById.get(space.parentId)?.title ?? null) : null,
          deletedAt: (space.deletedAt as Date).toISOString(),
        }),
      );

    const pageItems = deletedPages.map(
      (page): TrashItem => ({
        id: page.id,
        type: 'page',
        title: isHidden(page.spaceId) ? HIDDEN_TITLE : page.title || 'Untitled',
        location: spacePath(page.spaceId),
        deletedAt: (page.deletedAt as Date).toISOString(),
      }),
    );

    const vaultTrashItems = deletedVaultItems.map(
      (item): TrashItem => ({
        id: item.id,
        type: 'vault-item',
        title: 'Encrypted item',
        location: spacePath(item.spaceId),
        deletedAt: (item.deletedAt as Date).toISOString(),
        payload: { iv: item.iv, ciphertext: item.ciphertext },
      }),
    );

    return [...taskItems, ...spaceItems, ...pageItems, ...vaultTrashItems].sort((a, b) =>
      b.deletedAt.localeCompare(a.deletedAt),
    );
  }

  async restoreVaultItem(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [item] = await tx
        .update(vaultItems)
        .set({ deletedAt: null })
        .where(and(eq(vaultItems.id, id), eq(vaultItems.userId, userId), isNotNull(vaultItems.deletedAt)))
        .returning({ spaceId: vaultItems.spaceId });
      if (!item) throw new NotFoundException('Not in the trash');
      await this.restoreSpaceChain(tx, item.spaceId);
    });
  }

  async restorePage(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [page] = await tx
        .update(notebookPages)
        .set({ deletedAt: null })
        .where(and(eq(notebookPages.id, id), eq(notebookPages.userId, userId), isNotNull(notebookPages.deletedAt)))
        .returning({ spaceId: notebookPages.spaceId });
      if (!page) throw new NotFoundException('Not in the trash');
      await this.restoreSpaceChain(tx, page.spaceId);
    });
  }

  async restoreTask(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNotNull(tasks.deletedAt)));
      if (!task) throw new NotFoundException('Not in the trash');

      await tx.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, id));
      await this.restoreSpaceChain(tx, task.spaceId);

      let parentId = task.parentId;
      while (parentId) {
        const [parent] = await tx
          .update(tasks)
          .set({ deletedAt: null })
          .where(eq(tasks.id, parentId))
          .returning({ parentId: tasks.parentId });
        if (task.completedOn === null) {
          await tx
            .update(tasks)
            .set({ completedOn: null, status: 'todo' })
            .where(and(eq(tasks.id, parentId), isNotNull(tasks.completedOn)));
        }
        parentId = parent?.parentId ?? null;
      }
    });
  }

  async restoreSpace(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [space] = await tx
        .select({ id: spaces.id })
        .from(spaces)
        .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNotNull(spaces.deletedAt)));
      if (!space) throw new NotFoundException('Not in the trash');
      await this.restoreSpaceChain(tx, id);
    });
  }

  private async restoreSpaceChain(tx: Db, spaceId: string): Promise<void> {
    const [space] = await tx
      .update(spaces)
      .set({ deletedAt: null })
      .where(eq(spaces.id, spaceId))
      .returning({ parentId: spaces.parentId, groupId: spaces.groupId });
    const [top] = space?.parentId
      ? await tx.update(spaces).set({ deletedAt: null }).where(eq(spaces.id, space.parentId)).returning({ groupId: spaces.groupId })
      : [space];
    // A sidebar group deleted with it comes back too.
    if (top?.groupId) await tx.update(spaceGroups).set({ deletedAt: null }).where(eq(spaceGroups.id, top.groupId));
  }
}
