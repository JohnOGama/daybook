import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, between, eq, inArray, isNotNull, isNull, lte, or, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, tasks, type TaskStatus } from '../../../shared/db/schema.ts';
import { copyTitle } from '../../../shared/utils/copy-title.ts';
import { appearsOn } from './task-rules.ts';

type TaskRow = typeof tasks.$inferSelect;

export type TaskDto = {
  id: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  highPriority: boolean;
  finished: boolean;
  day: string;
  plannedDay: string | null;
  completedOn: string | null;
  dueDay: string | null;
  createdAt: string;
  subtasks: TaskDto[];
};

function toDto(row: TaskRow, day: string, subtasks: TaskDto[] = []): TaskDto {
  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    status: row.status,
    highPriority: row.highPriority,
    finished: row.completedOn !== null,
    day,
    plannedDay: row.plannedDay,
    completedOn: row.completedOn,
    dueDay: row.dueDay,
    createdAt: row.createdAt.toISOString(),
    subtasks,
  };
}

type PastedTask = { id: string; title: string; subtasks: PastedTask[] };

const MAX_PASTED_TASKS = 2000;

function flattenPasted(list: PastedTask[], parentId: string | null): { id: string; title: string; parentId: string | null }[] {
  return list.flatMap(({ id, title, subtasks }) => [{ id, title, parentId }, ...flattenPasted(subtasks, id)]);
}

function assertPasteSize(rows: unknown[]): void {
  if (rows.length > MAX_PASTED_TASKS) throw new BadRequestException('That list is too long to add at once');
}

function unfinishedFields(row: TaskRow): Pick<TaskRow, 'spaceId' | 'status' | 'highPriority' | 'dueDay'> {
  return {
    spaceId: row.spaceId,
    status: row.completedOn ? 'todo' : row.status,
    highPriority: row.highPriority,
    dueDay: row.dueDay,
  };
}

@Injectable()
export class TasksService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(
    userId: string,
    spaceId: string,
    range: { from: string; to: string; today: string },
  ): Promise<TaskDto[]> {
    const { from, to, today } = range;
    const carryOver = await this.carriesOver(this.db, userId, spaceId);
    const candidates = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.spaceId, spaceId),
          isNull(tasks.parentId),
          isNull(tasks.deletedAt),
          or(
            between(tasks.completedOn, from, to),
            and(isNull(tasks.completedOn), lte(tasks.plannedDay, to)),
          ),
        ),
      )
      .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id));

    const placed = candidates
      .map((row) => ({
        row,
        day: appearsOn({ plannedDay: row.plannedDay as string, completedOn: row.completedOn }, today, carryOver),
      }))
      .filter(({ day }) => day >= from && day <= to);
    if (placed.length === 0) return [];

    const descendants = await this.descendantsOf(
      this.db,
      userId,
      placed.map(({ row }) => row.id),
    );
    const childrenOf = new Map<string | null, TaskRow[]>();
    for (const child of descendants) childrenOf.set(child.parentId, [...(childrenOf.get(child.parentId) ?? []), child]);
    const withChildren = (row: TaskRow, day: string): TaskDto =>
      toDto(
        row,
        day,
        (childrenOf.get(row.id) ?? []).map((child) => withChildren(child, day)),
      );

    return placed.map(({ row, day }) => withChildren(row, day));
  }

  async create(
    userId: string,
    input: { id?: string; spaceId: string; title: string; day: string; status?: TaskStatus; highPriority?: boolean; dueDay?: string | null },
  ): Promise<void> {
    await this.assertTaskSpace(this.db, userId, input.spaceId);
    const { day, ...fields } = input;
    await this.db.insert(tasks).values({ ...fields, userId, plannedDay: day });
  }

  async createMany(
    userId: string,
    input: {
      spaceId: string;
      day: string;
      tasks: PastedTask[];
    },
  ): Promise<void> {
    const { spaceId, day, tasks: pasted } = input;
    const rows = flattenPasted(pasted, null);
    assertPasteSize(rows);
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await this.assertTaskSpace(tx, userId, spaceId);
      await tx.insert(tasks).values(
        rows.map((row, index) => ({
          ...row,
          userId,
          spaceId,
          plannedDay: row.parentId === null ? day : null,
          // Unpositioned tasks sort by createdAt, and one insert would otherwise give them all the same time.
          createdAt: new Date(now + index),
        })),
      );
    });
  }

  async update(
    userId: string,
    id: string,
    input: { title?: string; status?: TaskStatus; highPriority?: boolean; day?: string; dueDay?: string | null },
  ): Promise<void> {
    const task = await this.findOwned(this.db, userId, id);
    const { day, ...fields } = input;
    if (day !== undefined && (task.parentId !== null || task.completedOn !== null)) {
      throw new BadRequestException('Only an unfinished top-level task can change day');
    }
    const changes = { ...fields, ...(day === undefined ? {} : { plannedDay: day }) };
    if (Object.keys(changes).length === 0) return;
    await this.db.update(tasks).set(changes).where(eq(tasks.id, id));
  }

  async setFinished(
    userId: string,
    id: string,
    finished: boolean,
    today: string,
    reopenAs?: TaskStatus,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const task = await this.lockFamily(tx, userId, id);
      const descendants = await this.descendantsOf(tx, userId, [id]);
      const subtree = [id, ...descendants.map((row) => row.id)];
      if (finished) {
        await this.finish(tx, inArray(tasks.id, subtree), today);
        await this.finishAncestorsIfAllDone(tx, task.parentId, today);
      } else {
        await this.reopen(tx, inArray(tasks.id, [...subtree, ...(await this.ancestorIds(tx, task))]));
      }
      if (!finished && reopenAs) await tx.update(tasks).set({ status: reopenAs }).where(eq(tasks.id, id));
    });
  }

  async createSubtask(
    userId: string,
    parentId: string,
    input: { id?: string; title: string; status?: TaskStatus; highPriority?: boolean; dueDay?: string | null },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const parent = await this.lockFamily(tx, userId, parentId);
      await tx.insert(tasks).values({ ...input, userId, parentId, spaceId: parent.spaceId });
      await this.reopen(tx, inArray(tasks.id, [parentId, ...(await this.ancestorIds(tx, parent))]));
    });
  }

  async createManySubtasks(
    userId: string,
    parentId: string,
    subtasks: PastedTask[],
  ): Promise<void> {
    const rows = flattenPasted(subtasks, parentId);
    assertPasteSize(rows);
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      const parent = await this.lockFamily(tx, userId, parentId);
      await tx.insert(tasks).values(
        rows.map((row, index) => ({
          ...row,
          userId,
          spaceId: parent.spaceId,
          createdAt: new Date(now + index),
        })),
      );
      await this.reopen(tx, inArray(tasks.id, [parentId, ...(await this.ancestorIds(tx, parent))]));
    });
  }

  async reorder(userId: string, ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each task can appear only once');
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ parentId: tasks.parentId, spaceId: tasks.spaceId })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt), inArray(tasks.id, ids)));
      if (rows.length !== ids.length) throw new NotFoundException('Task not found');
      const [first] = rows;
      if (rows.some((row) => row.parentId !== first.parentId || row.spaceId !== first.spaceId)) {
        throw new BadRequestException('Only tasks in the same list can be reordered together');
      }
      for (const [position, id] of ids.entries()) {
        await tx.update(tasks).set({ position }).where(eq(tasks.id, id));
      }
    });
  }

  async copy(
    userId: string,
    id: string,
    today: string,
    targetSpaceId?: string,
    newIds?: Record<string, string>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const original = await this.lockFamily(tx, userId, id);
      if (original.parentId !== null) {
        throw new BadRequestException('Only a top-level task can be copied');
      }
      const spaceId = targetSpaceId ?? original.spaceId;
      if (spaceId !== original.spaceId) await this.assertTaskSpace(tx, userId, spaceId);
      const subtasks = await this.descendantsOf(tx, userId, [id]);

      const [copy] = await tx
        .insert(tasks)
        .values({
          ...unfinishedFields(original),
          id: newIds?.[original.id],
          spaceId,
          userId,
          title: spaceId === original.spaceId ? copyTitle(original.title) : original.title,
          plannedDay: appearsOn(
            { plannedDay: original.plannedDay as string, completedOn: original.completedOn },
            today,
            await this.carriesOver(tx, userId, original.spaceId),
          ),
        })
        .returning({ id: tasks.id });

      if (subtasks.length === 0) return;
      const copiedIds = new Map([[id, copy.id], ...subtasks.map((subtask) => [subtask.id, newIds?.[subtask.id] ?? randomUUID()] as const)]);
      const start = Date.now();
      await tx.insert(tasks).values(
        subtasks.map((subtask, index) => ({
          ...unfinishedFields(subtask),
          id: copiedIds.get(subtask.id),
          spaceId,
          userId,
          parentId: copiedIds.get(subtask.parentId as string),
          title: subtask.title,
          createdAt: new Date(start + index),
        })),
      );
    });
  }

  async remove(userId: string, id: string, today: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const task = await this.lockFamily(tx, userId, id);
      await tx.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id));
      await this.finishAncestorsIfAllDone(tx, task.parentId, today);
    });
  }

  async removeMany(userId: string, ids: string[]): Promise<void> {
    await this.db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.userId, userId), isNull(tasks.parentId), isNull(tasks.deletedAt), inArray(tasks.id, ids)));
  }

  private async carriesOver(db: Db, userId: string, spaceId: string): Promise<boolean> {
    const [space] = await db
      .select({ carryOver: spaces.carryOver })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
    return space?.carryOver ?? true;
  }

  private async assertTaskSpace(db: Db, userId: string, spaceId: string): Promise<void> {
    const [space] = await db
      .select({ tool: spaces.tool })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Space not found');
    if (space.tool !== 'list') throw new BadRequestException('Only a List space can hold tasks');
  }

  private async lockFamily(tx: Db, userId: string, id: string): Promise<TaskRow> {
    const task = await this.findOwned(tx, userId, id);
    const rootId = (await this.ancestorIds(tx, task)).at(-1) ?? task.id;
    await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, rootId)).for('update');
    return this.findOwned(tx, userId, id);
  }

  private async ancestorIds(db: Db, task: Pick<TaskRow, 'parentId'>): Promise<string[]> {
    const ids: string[] = [];
    let parentId = task.parentId;
    while (parentId) {
      ids.push(parentId);
      const [parent] = await db.select({ parentId: tasks.parentId }).from(tasks).where(eq(tasks.id, parentId));
      parentId = parent?.parentId ?? null;
    }
    return ids;
  }

  private async descendantsOf(db: Db, userId: string, parentIds: string[]): Promise<TaskRow[]> {
    const descendants: TaskRow[] = [];
    let level = parentIds;
    while (level.length > 0) {
      const children = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt), inArray(tasks.parentId, level)))
        .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id));
      descendants.push(...children);
      level = children.map((child) => child.id);
    }
    return descendants;
  }

  private async finish(tx: Db, scope: SQL, today: string): Promise<void> {
    await tx
      .update(tasks)
      .set({ completedOn: today })
      .where(and(scope, isNull(tasks.completedOn)));
  }

  private async reopen(tx: Db, scope: SQL): Promise<void> {
    await tx
      .update(tasks)
      .set({ completedOn: null, status: 'todo' })
      .where(and(scope, isNotNull(tasks.completedOn)));
  }

  private async finishAncestorsIfAllDone(tx: Db, startId: string | null, today: string): Promise<void> {
    let parentId = startId;
    while (parentId) {
      const subtasks = await tx
        .select({ completedOn: tasks.completedOn })
        .from(tasks)
        .where(and(eq(tasks.parentId, parentId), isNull(tasks.deletedAt)));
      if (subtasks.length === 0 || subtasks.some((subtask) => subtask.completedOn === null)) return;
      await this.finish(tx, eq(tasks.id, parentId), today);
      const [parent] = await tx.select({ parentId: tasks.parentId }).from(tasks).where(eq(tasks.id, parentId));
      parentId = parent?.parentId ?? null;
    }
  }

  private async findOwned(db: Db, userId: string, id: string): Promise<TaskRow> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)));
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
