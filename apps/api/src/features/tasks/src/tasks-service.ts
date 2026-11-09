import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
    createdAt: row.createdAt.toISOString(),
    subtasks,
  };
}

function unfinishedFields(row: TaskRow): Pick<TaskRow, 'spaceId' | 'status' | 'highPriority'> {
  return {
    spaceId: row.spaceId,
    status: row.completedOn ? 'todo' : row.status,
    highPriority: row.highPriority,
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
        day: appearsOn({ plannedDay: row.plannedDay as string, completedOn: row.completedOn }, today),
      }))
      .filter(({ day }) => day >= from && day <= to);
    if (placed.length === 0) return [];

    const children = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          inArray(
            tasks.parentId,
            placed.map(({ row }) => row.id),
          ),
        ),
      )
      .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id));

    return placed.map(({ row, day }) =>
      toDto(
        row,
        day,
        children.filter((child) => child.parentId === row.id).map((child) => toDto(child, day)),
      ),
    );
  }

  async create(
    userId: string,
    input: { id?: string; spaceId: string; title: string; day: string; status?: TaskStatus; highPriority?: boolean },
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
      tasks: { id: string; title: string; subtasks: { id: string; title: string }[] }[];
    },
  ): Promise<void> {
    const { spaceId, day, tasks: pasted } = input;
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await this.assertTaskSpace(tx, userId, spaceId);
      await tx.insert(tasks).values(
        pasted.map(({ id, title }, index) => ({
          id,
          title,
          userId,
          spaceId,
          plannedDay: day,
          // Unpositioned tasks sort by createdAt, and one insert would otherwise give them all the same time.
          createdAt: new Date(now + index),
        })),
      );
      const subtasks = pasted.flatMap(({ id: parentId, subtasks: children }) =>
        children.map(({ id, title }, position) => ({ id, title, userId, spaceId, parentId, position })),
      );
      if (subtasks.length > 0) await tx.insert(tasks).values(subtasks);
    });
  }

  async update(
    userId: string,
    id: string,
    input: { title?: string; status?: TaskStatus; highPriority?: boolean; day?: string },
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
      if (task.parentId === null) {
        const family = or(eq(tasks.id, id), and(eq(tasks.parentId, id), isNull(tasks.deletedAt))) as SQL;
        await (finished ? this.finish(tx, family, today) : this.reopen(tx, family));
      } else if (finished) {
        await this.finish(tx, eq(tasks.id, id), today);
        await this.finishParentIfAllDone(tx, task.parentId, today);
      } else {
        await this.reopen(tx, or(eq(tasks.id, id), eq(tasks.id, task.parentId)) as SQL);
      }
      if (!finished && reopenAs) await tx.update(tasks).set({ status: reopenAs }).where(eq(tasks.id, id));
    });
  }

  async createSubtask(
    userId: string,
    parentId: string,
    input: { id?: string; title: string; status?: TaskStatus; highPriority?: boolean },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const parent = await this.lockFamily(tx, userId, parentId);
      if (parent.parentId !== null) {
        throw new BadRequestException('A subtask cannot have subtasks');
      }
      await tx.insert(tasks).values({ ...input, userId, parentId, spaceId: parent.spaceId });
      await this.reopen(tx, eq(tasks.id, parentId));
    });
  }

  async createManySubtasks(
    userId: string,
    parentId: string,
    subtasks: { id: string; title: string }[],
  ): Promise<void> {
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      const parent = await this.lockFamily(tx, userId, parentId);
      if (parent.parentId !== null) {
        throw new BadRequestException('A subtask cannot have subtasks');
      }
      await tx.insert(tasks).values(
        subtasks.map(({ id, title }, index) => ({
          id,
          title,
          userId,
          parentId,
          spaceId: parent.spaceId,
          createdAt: new Date(now + index),
        })),
      );
      await this.reopen(tx, eq(tasks.id, parentId));
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
      const subtasks = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.parentId, id), isNull(tasks.deletedAt)))
        .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id));

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
          ),
        })
        .returning({ id: tasks.id });

      if (subtasks.length === 0) return;
      const start = Date.now();
      await tx.insert(tasks).values(
        subtasks.map((subtask, index) => ({
          ...unfinishedFields(subtask),
          id: newIds?.[subtask.id],
          spaceId,
          userId,
          parentId: copy.id,
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
      if (task.parentId !== null) {
        await this.finishParentIfAllDone(tx, task.parentId, today);
      }
    });
  }

  async removeMany(userId: string, ids: string[]): Promise<void> {
    await this.db
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.userId, userId), isNull(tasks.parentId), isNull(tasks.deletedAt), inArray(tasks.id, ids)));
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
    await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, task.parentId ?? task.id))
      .for('update');
    return this.findOwned(tx, userId, id);
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

  private async finishParentIfAllDone(tx: Db, parentId: string, today: string): Promise<void> {
    const subtasks = await tx
      .select({ completedOn: tasks.completedOn })
      .from(tasks)
      .where(and(eq(tasks.parentId, parentId), isNull(tasks.deletedAt)));
    if (subtasks.length > 0 && subtasks.every((subtask) => subtask.completedOn !== null)) {
      await this.finish(tx, eq(tasks.id, parentId), today);
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
