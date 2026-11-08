import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, between, eq, inArray, isNotNull, isNull, lte, or, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { tasks, type TaskStatus } from '../../../shared/db/schema.ts';
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
    createdAt: row.createdAt.toISOString(),
    subtasks,
  };
}

@Injectable()
export class TasksService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(
    userId: string,
    range: { from: string; to: string; today: string },
  ): Promise<TaskDto[]> {
    const { from, to, today } = range;
    const candidates = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.parentId),
          or(
            between(tasks.completedOn, from, to),
            and(isNull(tasks.completedOn), lte(tasks.plannedDay, to)),
          ),
        ),
      )
      .orderBy(asc(tasks.createdAt), asc(tasks.id));

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
        inArray(
          tasks.parentId,
          placed.map(({ row }) => row.id),
        ),
      )
      .orderBy(asc(tasks.createdAt), asc(tasks.id));

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
    input: { title: string; day: string; status?: TaskStatus; highPriority?: boolean },
  ): Promise<void> {
    const { day, ...fields } = input;
    await this.db.insert(tasks).values({ ...fields, userId, plannedDay: day });
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

  async setFinished(userId: string, id: string, finished: boolean, today: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const task = await this.lockFamily(tx, userId, id);
      if (task.parentId === null) {
        const family = or(eq(tasks.id, id), eq(tasks.parentId, id)) as SQL;
        await (finished ? this.finish(tx, family, today) : this.reopen(tx, family));
        return;
      }
      if (finished) {
        await this.finish(tx, eq(tasks.id, id), today);
        await this.finishParentIfAllDone(tx, task.parentId, today);
      } else {
        await this.reopen(tx, or(eq(tasks.id, id), eq(tasks.id, task.parentId)) as SQL);
      }
    });
  }

  async createSubtask(
    userId: string,
    parentId: string,
    input: { title: string; status?: TaskStatus; highPriority?: boolean },
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const parent = await this.lockFamily(tx, userId, parentId);
      if (parent.parentId !== null) {
        throw new BadRequestException('A subtask cannot have subtasks');
      }
      await tx.insert(tasks).values({ ...input, userId, parentId });
      await this.reopen(tx, eq(tasks.id, parentId));
    });
  }

  async remove(userId: string, id: string, today: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const task = await this.lockFamily(tx, userId, id);
      await tx.delete(tasks).where(eq(tasks.id, id));
      if (task.parentId !== null) {
        await this.finishParentIfAllDone(tx, task.parentId, today);
      }
    });
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
      .where(eq(tasks.parentId, parentId));
    if (subtasks.length > 0 && subtasks.every((subtask) => subtask.completedOn !== null)) {
      await this.finish(tx, eq(tasks.id, parentId), today);
    }
  }

  private async findOwned(db: Db, userId: string, id: string): Promise<TaskRow> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
