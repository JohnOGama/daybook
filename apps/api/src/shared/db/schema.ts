import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';

export * from './auth-schema.ts';

export const taskStatus = pgEnum('task_status', ['todo', 'in_progress', 'on_hold']);
export type TaskStatus = (typeof taskStatus.enumValues)[number];

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    plannedDay: date('planned_day', { mode: 'string' }),
    status: taskStatus('status').notNull().default('todo'),
    highPriority: boolean('high_priority').notNull().default(false),
    completedOn: date('completed_on', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('tasks_day_only_on_top_level', sql`(${t.parentId} IS NULL) = (${t.plannedDay} IS NOT NULL)`),
    index('tasks_user_day_idx').on(t.userId, t.plannedDay),
    index('tasks_parent_idx').on(t.parentId),
  ],
);
