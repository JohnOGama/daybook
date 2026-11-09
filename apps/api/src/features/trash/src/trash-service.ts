import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNotNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, tasks } from '../../../shared/db/schema.ts';

export type TrashItem = {
  id: string;
  type: 'task' | 'subtask' | 'space' | 'folder';
  title: string;
  location: string | null;
  deletedAt: string;
};

@Injectable()
export class TrashService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<TrashItem[]> {
    const [allSpaces, deletedTasks] = await Promise.all([
      this.db.select().from(spaces).where(eq(spaces.userId, userId)),
      this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNotNull(tasks.deletedAt))),
    ]);
    const spacesById = new Map(allSpaces.map((space) => [space.id, space]));
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
      const parentTitle = task.parentId ? parentTitles.get(task.parentId) : undefined;
      return {
        id: task.id,
        type: task.parentId ? 'subtask' : 'task',
        title: task.title,
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

    return [...taskItems, ...spaceItems].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
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
      if (task.parentId === null) return;

      await tx.update(tasks).set({ deletedAt: null }).where(eq(tasks.id, task.parentId));
      if (task.completedOn === null) {
        await tx
          .update(tasks)
          .set({ completedOn: null, status: 'todo' })
          .where(and(eq(tasks.id, task.parentId), isNotNull(tasks.completedOn)));
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
      .returning({ parentId: spaces.parentId });
    if (space?.parentId) {
      await tx.update(spaces).set({ deletedAt: null }).where(eq(spaces.id, space.parentId));
    }
  }
}
