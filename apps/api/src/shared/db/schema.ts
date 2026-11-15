import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.ts';

export * from './auth-schema.ts';

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => 'bytea', toDriver: (value) => Buffer.from(value) });

export const taskStatus = pgEnum('task_status', ['todo', 'in_progress', 'on_hold']);
export type TaskStatus = (typeof taskStatus.enumValues)[number];

export const spaceKind = pgEnum('space_kind', ['folder', 'space']);
export const spaceTool = pgEnum('space_tool', ['list', 'notebook', 'vault', 'book', 'budget', 'fitness', 'jobs', 'diagram', 'pipelines']);

export const shareRole = pgEnum('share_role', ['edit', 'view']);
export type ShareRole = (typeof shareRole.enumValues)[number];

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
    lockHash: text('lock_hash'),
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
    position: integer('position'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    version: integer('version').notNull().default(0),
  },
  (t) => [index('notebook_pages_space_idx').on(t.spaceId)],
);

export const notebookPageVersions = pgTable(
  'notebook_page_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => notebookPages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notebook_page_versions_page_idx').on(t.pageId, t.createdAt)],
);

export const vaults = pgTable('vaults', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  salt: text('salt').notNull(),
  iterations: integer('iterations').notNull(),
  wrappedKey: text('wrapped_key').notNull(),
  recoverySalt: text('recovery_salt').notNull(),
  recoveryWrappedKey: text('recovery_wrapped_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vaultItems = pgTable(
  'vault_items',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    iv: text('iv').notNull(),
    ciphertext: text('ciphertext').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('vault_items_space_idx').on(t.spaceId)],
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

export const budgetAccountType = pgEnum('budget_account_type', ['cash', 'bank', 'savings', 'ewallet', 'credit', 'loan']);
export const budgetCategoryKind = pgEnum('budget_category_kind', ['income', 'expense']);
export const budgetEntryKind = pgEnum('budget_entry_kind', ['income', 'expense', 'transfer']);

// Amounts are whole cents of the space's currency.
const cents = (name: string) => bigint(name, { mode: 'number' });

export const budgets = pgTable('budgets', {
  spaceId: uuid('space_id')
    .primaryKey()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull().default('USD'),
  // The forecast warns when the projected balance would drop below this.
  lowBalance: cents('low_balance').notNull().default(0),
  // How much one unit of each other currency is worth in this budget's currency, set by hand.
  rates: jsonb('rates').$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const budgetAccounts = pgTable(
  'budget_accounts',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: budgetAccountType('type').notNull(),
    openingBalance: cents('opening_balance').notNull().default(0),
    // Debt details for credit cards and loans: yearly interest in basis points, the monthly due day (-1 for the last day) and the minimum payment.
    aprBps: integer('apr_bps'),
    dueDay: integer('due_day'),
    minimumPayment: cents('minimum_payment'),
    // Null means the budget's own currency.
    currency: text('currency'),
    // A preset logo key such as 'gcash'; the web app owns the list.
    icon: text('icon'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('budget_accounts_space_idx').on(t.spaceId)],
);

export const budgetCategories = pgTable(
  'budget_categories',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: budgetCategoryKind('kind').notNull(),
    monthlyLimit: cents('monthly_limit'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('budget_categories_limit_on_expense', sql`${t.monthlyLimit} IS NULL OR (${t.kind} = 'expense' AND ${t.monthlyLimit} > 0)`),
    index('budget_categories_space_idx').on(t.spaceId),
  ],
);

export const budgetFrequency = pgEnum('budget_frequency', ['daily', 'weekly', 'monthly', 'yearly']);

// A repeating entry. Each occurrence becomes a real entry only once it's recorded, linked back by scheduleId and occurrenceDay.
export const budgetSchedules = pgTable(
  'budget_schedules',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: budgetEntryKind('kind').notNull(),
    amount: cents('amount').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => budgetAccounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id').references(() => budgetAccounts.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => budgetCategories.id, { onDelete: 'set null' }),
    frequency: budgetFrequency('frequency').notNull(),
    interval: integer('interval').notNull().default(1),
    monthDays: integer('month_days').array().notNull().default(sql`'{}'::integer[]`),
    startDay: date('start_day', { mode: 'string' }).notNull(),
    endDay: date('end_day', { mode: 'string' }),
    activeFrom: date('active_from', { mode: 'string' }).notNull(),
    pausedFrom: date('paused_from', { mode: 'string' }),
    skippedDays: date('skipped_days', { mode: 'string' }).array().notNull().default(sql`'{}'::date[]`),
    autoRecord: boolean('auto_record').notNull().default(false),
    isSubscription: boolean('is_subscription').notNull().default(false),
    icon: text('icon'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('budget_schedules_amount_positive', sql`${t.amount} > 0`),
    check(
      'budget_schedules_transfer_shape',
      sql`(${t.kind} = 'transfer') = (${t.toAccountId} IS NOT NULL) AND (${t.kind} <> 'transfer' OR ${t.categoryId} IS NULL)`,
    ),
    check('budget_schedules_interval_range', sql`${t.interval} BETWEEN 1 AND 365`),
    check('budget_schedules_end_after_start', sql`${t.endDay} IS NULL OR ${t.endDay} >= ${t.startDay}`),
    index('budget_schedules_space_idx').on(t.spaceId),
  ],
);

export const budgetEntries = pgTable(
  'budget_entries',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    kind: budgetEntryKind('kind').notNull(),
    amount: cents('amount').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => budgetAccounts.id, { onDelete: 'cascade' }),
    toAccountId: uuid('to_account_id').references(() => budgetAccounts.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => budgetCategories.id, { onDelete: 'set null' }),
    day: date('day', { mode: 'string' }).notNull(),
    note: text('note').notNull().default(''),
    // What arrived when a transfer crosses currencies, in the receiving account's currency.
    toAmount: cents('to_amount'),
    // An optional preset logo key, like the ones on accounts and schedules.
    icon: text('icon'),
    scheduleId: uuid('schedule_id').references(() => budgetSchedules.id, { onDelete: 'set null' }),
    occurrenceDay: date('occurrence_day', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Recording the same occurrence of a schedule twice is impossible, even from two tabs at once.
    uniqueIndex('budget_entries_occurrence_idx').on(t.scheduleId, t.occurrenceDay),
    check('budget_entries_amount_positive', sql`${t.amount} > 0`),
    check('budget_entries_to_amount_on_transfer', sql`${t.toAmount} IS NULL OR (${t.kind} = 'transfer' AND ${t.toAmount} > 0)`),
    check(
      'budget_entries_transfer_shape',
      sql`(${t.kind} = 'transfer') = (${t.toAccountId} IS NOT NULL) AND (${t.kind} <> 'transfer' OR ${t.categoryId} IS NULL)`,
    ),
    check('budget_entries_transfer_accounts_differ', sql`${t.toAccountId} IS NULL OR ${t.toAccountId} <> ${t.accountId}`),
    index('budget_entries_space_day_idx').on(t.spaceId, t.day),
  ],
);

export const budgetGoals = pgTable(
  'budget_goals',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    target: cents('target').notNull(),
    targetDay: date('target_day', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('budget_goals_target_positive', sql`${t.target} > 0`), index('budget_goals_space_idx').on(t.spaceId)],
);

// Money set aside for a goal, or taken back out when negative. It doesn't move money between accounts.
export const budgetGoalContributions = pgTable(
  'budget_goal_contributions',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => budgetGoals.id, { onDelete: 'cascade' }),
    amount: cents('amount').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    note: text('note').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('budget_goal_contributions_amount_nonzero', sql`${t.amount} <> 0`), index('budget_goal_contributions_goal_idx').on(t.goalId)],
);

// One photo per entry, kept as base64 so it needs no file storage.
// ponytail: images live in Postgres; move them to object storage if receipts pile up past a few hundred MB
export const budgetReceipts = pgTable('budget_receipts', {
  entryId: uuid('entry_id')
    .primaryKey()
    .references(() => budgetEntries.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  mediaType: text('media_type').notNull(),
  data: text('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Fitness. Food weight and macros are whole milligrams, energy whole kcal, body weight whole grams.
const ownedBySpace = () => ({
  spaceId: uuid('space_id')
    .notNull()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

// Built-in rows (USDA foods, the exercise list) have no space and no owner; custom rows have both.
const sharedOrOwned = () => ({
  spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
});

const nutrition = () => ({
  kcal: integer('kcal').notNull(),
  proteinMg: integer('protein_mg').notNull(),
  carbsMg: integer('carbs_mg').notNull(),
  fatMg: integer('fat_mg').notNull(),
  fiberMg: integer('fiber_mg').notNull(),
});

export const fitnessProfiles = pgTable('fitness_profiles', {
  spaceId: uuid('space_id')
    .primaryKey()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  profile: jsonb('profile').$type<Record<string, unknown>>().notNull(),
});

// Nutrition is per 100 g.
export const fitnessFoods = pgTable(
  'fitness_foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...sharedOrOwned(),
    fdcId: integer('fdc_id').unique(),
    name: text('name').notNull(),
    category: text('category'),
    ...nutrition(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('fitness_foods_space_idx').on(t.spaceId)],
);

export const fitnessFoodServings = pgTable(
  'fitness_food_servings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    foodId: uuid('food_id')
      .notNull()
      .references(() => fitnessFoods.id, { onDelete: 'cascade' }),
    ...sharedOrOwned(),
    label: text('label').notNull(),
    amountMg: integer('amount_mg').notNull(),
  },
  (t) => [index('fitness_food_servings_food_idx').on(t.foodId)],
);

// A logged food keeps its own name and numbers, so later edits to the food never change a past day.
export const fitnessFoodLogs = pgTable(
  'fitness_food_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedBySpace(),
    day: date('day').notNull(),
    meal: text('meal').notNull(),
    foodId: uuid('food_id').references(() => fitnessFoods.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    quantityMilli: integer('quantity_milli').notNull(),
    servingLabel: text('serving_label').notNull(),
    amountMg: integer('amount_mg').notNull(),
    ...nutrition(),
    eaten: boolean('eaten').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('fitness_food_logs_day_idx').on(t.spaceId, t.day)],
);

export const fitnessMealPlans = pgTable(
  'fitness_meal_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedBySpace(),
    name: text('name').notNull(),
    items: jsonb('items').$type<unknown[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(0),
  },
  (t) => [index('fitness_meal_plans_space_idx').on(t.spaceId)],
);

export const fitnessWeights = pgTable(
  'fitness_weights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedBySpace(),
    day: date('day').notNull(),
    weightG: integer('weight_g').notNull(),
  },
  (t) => [uniqueIndex('fitness_weights_day_idx').on(t.spaceId, t.day)],
);

export const fitnessExercises = pgTable(
  'fitness_exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...sharedOrOwned(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    equipment: text('equipment'),
    primaryMuscles: jsonb('primary_muscles').$type<string[]>().notNull(),
    secondaryMuscles: jsonb('secondary_muscles').$type<string[]>().notNull(),
  },
  (t) => [
    index('fitness_exercises_space_idx').on(t.spaceId),
    uniqueIndex('fitness_exercises_builtin_name_idx').on(t.name).where(sql`${t.spaceId} IS NULL`),
  ],
);

export const fitnessWorkoutTemplates = pgTable(
  'fitness_workout_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedBySpace(),
    name: text('name').notNull(),
    items: jsonb('items').$type<unknown[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(0),
  },
  (t) => [index('fitness_workout_templates_space_idx').on(t.spaceId)],
);

export const fitnessWorkouts = pgTable(
  'fitness_workouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedBySpace(),
    day: date('day').notNull(),
    name: text('name').notNull(),
    items: jsonb('items').$type<unknown[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(0),
  },
  (t) => [index('fitness_workouts_day_idx').on(t.spaceId, t.day)],
);

// Job hunt. Each job keeps its status trail as one JSON array, always read and written with the job.
export const jobStatus = pgEnum('job_status', ['saved', 'applied', 'interviewing', 'offer', 'rejected']);
export const jobWorkMode = pgEnum('job_work_mode', ['remote', 'hybrid', 'onsite']);

export const jobProfiles = pgTable('job_profiles', {
  spaceId: uuid('space_id')
    .primaryKey()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  cvText: text('cv_text'),
  cvUpdatedAt: timestamp('cv_updated_at', { withTimezone: true, mode: 'string' }),
});

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey(),
    ...ownedBySpace(),
    role: text('role').notNull(),
    company: text('company').notNull(),
    url: text('url'),
    location: text('location'),
    workMode: jobWorkMode('work_mode'),
    salary: text('salary'),
    employmentType: text('employment_type'),
    postedOn: date('posted_on', { mode: 'string' }),
    description: text('description').notNull().default(''),
    notes: text('notes').notNull().default(''),
    status: jobStatus('status').notNull(),
    events: jsonb('events').$type<unknown[]>().notNull(),
    nextStepDay: date('next_step_day', { mode: 'string' }),
    nextStepNote: text('next_step_note'),
    matchPct: integer('match_pct'),
    matchSummary: text('match_summary'),
    skillsHave: jsonb('skills_have').$type<string[]>(),
    skillsMissing: jsonb('skills_missing').$type<string[]>(),
    matchedAt: timestamp('matched_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [index('jobs_space_idx').on(t.spaceId)],
);

// Database diagram: one DBML document per space, with where each table was dragged to.
export const diagrams = pgTable('diagrams', {
  spaceId: uuid('space_id')
    .primaryKey()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  dbml: text('dbml').notNull().default(''),
  positions: jsonb('positions').$type<Record<string, { x: number; y: number }>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  version: integer('version').notNull().default(0),
  // The live Yjs document; kept so a reconnecting browser's copy merges instead of doubling the text.
  ydoc: bytea('ydoc'),
});

// A space or folder shared with an email address (stored trimmed and lowercased).
export const spaceShares = pgTable(
  'space_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: shareRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('space_shares_space_email_idx').on(t.spaceId, t.email),
    index('space_shares_email_idx').on(t.email),
  ],
);

// One report key per Pipelines space, kept only as a SHA-256 hash; the plain key is shown once.
export const pipelineKeys = pgTable('pipeline_keys', {
  spaceId: uuid('space_id')
    .primaryKey()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'string' }),
});

// One CI run of one job, as Jenkins reports it. `status` is running | passed | failed, worked out from the stages and
// `finishStatus`, the run-level finish report (passed | failed | aborted, null until it arrives).
export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedBySpace(),
    job: text('job').notNull(),
    number: integer('number').notNull(),
    status: text('status').notNull(),
    finishStatus: text('finish_status'),
    url: text('url'),
    branch: text('branch'),
    commit: text('commit'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [uniqueIndex('pipeline_runs_space_job_number_idx').on(t.spaceId, t.job, t.number), index('pipeline_runs_space_idx').on(t.spaceId)],
);

// One stage of a run. `status` is running | passed | failed | skipped; `position` is the order stages first reported.
export const pipelineStages = pgTable(
  'pipeline_stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => pipelineRuns.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    status: text('status').notNull(),
    message: text('message'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [uniqueIndex('pipeline_stages_run_name_idx').on(t.runId, t.name)],
);
