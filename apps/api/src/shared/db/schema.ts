import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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

export const spaceKind = pgEnum('space_kind', ['folder', 'space']);
export const spaceTool = pgEnum('space_tool', ['list', 'notebook']);

export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => spaces.id, { onDelete: 'cascade' }),
    kind: spaceKind('kind').notNull(),
    title: text('title').notNull(),
    tool: spaceTool('tool'),
    carryOver: boolean('carry_over').notNull().default(true),
    position: integer('position'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('spaces_tool_only_on_space', sql`(${t.kind} = 'space') = (${t.tool} IS NOT NULL)`),
    check('spaces_folder_top_level', sql`${t.kind} = 'space' OR ${t.parentId} IS NULL`),
    index('spaces_user_idx').on(t.userId),
  ],
);

export const notebookPages = pgTable(
  'notebook_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    content: jsonb('content').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('notebook_pages_space_idx').on(t.spaceId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    plannedDay: date('planned_day', { mode: 'string' }),
    status: taskStatus('status').notNull().default('todo'),
    highPriority: boolean('high_priority').notNull().default(false),
    completedOn: date('completed_on', { mode: 'string' }),
    position: integer('position'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('tasks_day_only_on_top_level', sql`(${t.parentId} IS NULL) = (${t.plannedDay} IS NOT NULL)`),
    index('tasks_user_day_idx').on(t.userId, t.plannedDay),
    index('tasks_parent_idx').on(t.parentId),
    index('tasks_space_idx').on(t.spaceId),
  ],
);
