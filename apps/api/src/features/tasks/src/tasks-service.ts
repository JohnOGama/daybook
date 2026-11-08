import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, between, eq, inArray, isNull, lte, or } from 'drizzle-orm';
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

  private async findOwned(db: Db, userId: string, id: string): Promise<TaskRow> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
