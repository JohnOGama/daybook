import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { notebookPages, spaces, tasks } from '../../../shared/db/schema.ts';
import { copyTitle } from '../../../shared/utils/copy-title.ts';
import type { CreateSpaceInput } from './space-schemas.ts';

type SpaceRow = typeof spaces.$inferSelect;

export type SpaceDto = {
  id: string;
  parentId: string | null;
  kind: SpaceRow['kind'];
  title: string;
  tool: SpaceRow['tool'];
  createdAt: string;
  openToday: number;
};

function toDto(row: SpaceRow, openToday: number): SpaceDto {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind,
    title: row.title,
    tool: row.tool,
    createdAt: row.createdAt.toISOString(),
    openToday,
  };
}

@Injectable()
export class SpacesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string, today: string): Promise<SpaceDto[]> {
    const [rows, openTasks] = await Promise.all([
      this.db
        .select()
        .from(spaces)
        .where(and(eq(spaces.userId, userId), isNull(spaces.deletedAt)))
        .orderBy(asc(spaces.position), asc(spaces.createdAt), asc(spaces.id)),
      this.db
        .select({
          id: tasks.id,
          spaceId: tasks.spaceId,
          parentId: tasks.parentId,
          plannedDay: tasks.plannedDay,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.completedOn), isNull(tasks.deletedAt))),
    ]);

    const openById = new Map(openTasks.map((task) => [task.id, task]));
    const plannedDayOf = (task: (typeof openTasks)[number]): string | null | undefined => {
      if (!task.parentId) return task.plannedDay;
      const parent = openById.get(task.parentId);
      return parent && plannedDayOf(parent);
    };
    const counts = new Map<string, number>();
    for (const task of openTasks) {
      const day = plannedDayOf(task);
      if (day && day <= today) counts.set(task.spaceId, (counts.get(task.spaceId) ?? 0) + 1);
    }

    const visibleIds = new Set(rows.map((row) => row.id));
    return rows
      .filter((row) => row.parentId === null || visibleIds.has(row.parentId))
      .map((row) => toDto(row, counts.get(row.id) ?? 0));
  }

  async create(userId: string, input: CreateSpaceInput): Promise<SpaceDto> {
    const parentId = input.kind === 'space' ? input.parentId : undefined;
    if (parentId) await this.assertOwnedFolder(userId, parentId);
    const [created] = await this.db
      .insert(spaces)
      .values({
        id: input.id,
        userId,
        kind: input.kind,
        title: input.title,
        tool: input.kind === 'space' ? input.tool : null,
        parentId,
      })
      .returning();
    return toDto(created, 0);
  }

  async rename(userId: string, id: string, title: string): Promise<void> {
    const renamed = await this.db
      .update(spaces)
      .set({ title })
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    if (renamed.length === 0) throw new NotFoundException('Space not found');
  }

  async reorder(userId: string, ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each space can appear only once');
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ parentId: spaces.parentId })
        .from(spaces)
        .where(and(eq(spaces.userId, userId), isNull(spaces.deletedAt), inArray(spaces.id, ids)));
      if (rows.length !== ids.length) throw new NotFoundException('Space not found');
      if (rows.some((row) => row.parentId !== rows[0].parentId)) {
        throw new BadRequestException('Only spaces in the same group can be reordered together');
      }
      for (const [position, id] of ids.entries()) {
        await tx.update(spaces).set({ position }).where(eq(spaces.id, id));
      }
    });
  }

  async duplicate(userId: string, id: string, newId?: string): Promise<SpaceDto> {
    return this.db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(spaces)
        .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
      if (!source) throw new NotFoundException('Space not found');
      if (source.kind !== 'space') throw new BadRequestException('Only a space can be duplicated');

      const [copy] = await tx
        .insert(spaces)
        .values({
          id: newId,
          userId,
          parentId: source.parentId,
          kind: 'space',
          tool: source.tool,
          title: copyTitle(source.title),
        })
        .returning();

      const pages = await tx
        .select()
        .from(notebookPages)
        .where(and(eq(notebookPages.spaceId, id), isNull(notebookPages.deletedAt)));
      if (pages.length > 0) {
        await tx.insert(notebookPages).values(
          pages.map(({ title, content, createdAt }) => ({ userId, spaceId: copy.id, title, content, createdAt })),
        );
      }

      const inOrder = [asc(tasks.position), asc(tasks.createdAt), asc(tasks.id)];
      const parents = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.spaceId, id), isNull(tasks.parentId), isNull(tasks.completedOn), isNull(tasks.deletedAt)))
        .orderBy(...inOrder);
      if (parents.length === 0) return toDto(copy, 0);

      const copiedIds = new Map(parents.map((parent) => [parent.id, randomUUID()]));
      const shared = { userId, spaceId: copy.id };
      await tx.insert(tasks).values(
        parents.map((parent, position) => ({
          ...shared,
          id: copiedIds.get(parent.id),
          title: parent.title,
          plannedDay: parent.plannedDay,
          status: parent.status,
          highPriority: parent.highPriority,
          position,
        })),
      );

      let level = [...copiedIds.keys()];
      while (level.length > 0) {
        const subtasks = await tx
          .select()
          .from(tasks)
          .where(and(inArray(tasks.parentId, level), isNull(tasks.deletedAt)))
          .orderBy(...inOrder);
        if (subtasks.length === 0) break;
        for (const subtask of subtasks) copiedIds.set(subtask.id, randomUUID());
        await tx.insert(tasks).values(
          subtasks.map((subtask, position) => ({
            ...shared,
            id: copiedIds.get(subtask.id),
            parentId: copiedIds.get(subtask.parentId as string),
            title: subtask.title,
            status: subtask.completedOn ? ('todo' as const) : subtask.status,
            highPriority: subtask.highPriority,
            position,
          })),
        );
        level = subtasks.map((subtask) => subtask.id);
      }
      return toDto(copy, 0);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .update(spaces)
      .set({ deletedAt: new Date() })
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    if (deleted.length === 0) throw new NotFoundException('Space not found');
  }

  private async assertOwnedFolder(userId: string, id: string): Promise<void> {
    const [parent] = await this.db
      .select({ kind: spaces.kind })
      .from(spaces)
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
    if (!parent) throw new NotFoundException('Folder not found');
    if (parent.kind !== 'folder') throw new BadRequestException('Spaces can only go inside folders');
  }
}
