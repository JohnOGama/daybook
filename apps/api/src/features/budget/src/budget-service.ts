import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import {
  budgetAccounts,
  budgetCategories,
  budgetEntries,
  budgetGoalContributions,
  budgetGoals,
  budgetReceipts,
  budgetSchedules,
  budgets,
  spaces,
} from '../../../shared/db/schema.ts';
import { BudgetAiService } from './budget-ai-service.ts';
import type { EntryShape, FlowShape, ScheduleShape } from './budget-schemas.ts';

type AccountRow = typeof budgetAccounts.$inferSelect;
type CategoryRow = typeof budgetCategories.$inferSelect;
type EntryRow = typeof budgetEntries.$inferSelect;
type ScheduleRow = typeof budgetSchedules.$inferSelect;
type GoalRow = typeof budgetGoals.$inferSelect;
type ContributionRow = typeof budgetGoalContributions.$inferSelect;

export type BudgetDto = {
  currency: string;
  lowBalance: number;
  rates: Record<string, number>;
  accounts: Omit<AccountRow, 'userId' | 'spaceId' | 'createdAt'>[];
  categories: Pick<CategoryRow, 'id' | 'name' | 'kind' | 'monthlyLimit'>[];
  entries: (Omit<EntryRow, 'userId' | 'spaceId' | 'createdAt'> & { createdAt: string })[];
  schedules: Omit<ScheduleRow, 'userId' | 'spaceId' | 'createdAt'>[];
  goals: Pick<GoalRow, 'id' | 'name' | 'target' | 'targetDay'>[];
  contributions: Pick<ContributionRow, 'id' | 'goalId' | 'amount' | 'day' | 'note'>[];
  receiptEntryIds: string[];
  aiEnabled: boolean;
};

type Owned = typeof budgetAccounts | typeof budgetCategories | typeof budgetEntries | typeof budgetSchedules | typeof budgetGoals;
type AccountInput = Pick<AccountRow, 'name' | 'type' | 'openingBalance' | 'aprBps' | 'dueDay' | 'minimumPayment'> &
  Partial<Pick<AccountRow, 'currency' | 'icon'>>;

const STARTER_CATEGORIES = {
  expense: ['Food', 'Transport', 'Housing', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Subscriptions', 'Other'],
  income: ['Salary', 'Freelance', 'Gifts', 'Other income'],
};

@Injectable()
export class BudgetService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
  ) {}

  // ponytail: sends every entry; page by year once a budget holds tens of thousands of entries
  async load(userId: string, spaceId: string): Promise<BudgetDto> {
    await this.assertBudgetSpace(userId, spaceId);
    const budget = await this.ensureBudget(userId, spaceId);
    const owned = (table: Owned) => and(eq(table.spaceId, spaceId), eq(table.userId, userId));

    const [accounts, categories, entries, schedules, goals, contributions, receipts] = await Promise.all([
      this.db.select().from(budgetAccounts).where(owned(budgetAccounts)).orderBy(asc(budgetAccounts.createdAt), asc(budgetAccounts.id)),
      this.db.select().from(budgetCategories).where(owned(budgetCategories)).orderBy(asc(budgetCategories.createdAt), asc(budgetCategories.name)),
      this.db.select().from(budgetEntries).where(owned(budgetEntries)).orderBy(desc(budgetEntries.day), desc(budgetEntries.createdAt)),
      this.db.select().from(budgetSchedules).where(owned(budgetSchedules)).orderBy(asc(budgetSchedules.createdAt), asc(budgetSchedules.id)),
      this.db.select().from(budgetGoals).where(owned(budgetGoals)).orderBy(asc(budgetGoals.createdAt), asc(budgetGoals.id)),
      this.db
        .select({
          id: budgetGoalContributions.id,
          goalId: budgetGoalContributions.goalId,
          amount: budgetGoalContributions.amount,
          day: budgetGoalContributions.day,
          note: budgetGoalContributions.note,
        })
        .from(budgetGoalContributions)
        .innerJoin(budgetGoals, eq(budgetGoals.id, budgetGoalContributions.goalId))
        .where(and(owned(budgetGoals), eq(budgetGoalContributions.userId, userId)))
        .orderBy(desc(budgetGoalContributions.day), desc(budgetGoalContributions.createdAt)),
      this.db
        .select({ entryId: budgetReceipts.entryId })
        .from(budgetReceipts)
        .innerJoin(budgetEntries, eq(budgetEntries.id, budgetReceipts.entryId))
        .where(and(owned(budgetEntries), eq(budgetReceipts.userId, userId))),
    ]);

    return {
      currency: budget.currency,
      lowBalance: budget.lowBalance,
      rates: budget.rates,
      accounts: accounts.map(({ userId: _user, spaceId: _space, createdAt: _created, ...account }) => account),
      categories: categories.map(({ id, name, kind, monthlyLimit }) => ({ id, name, kind, monthlyLimit })),
      entries: entries.map(({ userId: _user, spaceId: _space, createdAt, ...entry }) => ({ ...entry, createdAt: createdAt.toISOString() })),
      schedules: schedules.map(({ userId: _user, spaceId: _space, createdAt: _created, ...schedule }) => schedule),
      goals: goals.map(({ id, name, target, targetDay }) => ({ id, name, target, targetDay })),
      contributions,
      receiptEntryIds: receipts.map(({ entryId }) => entryId),
      aiEnabled: this.ai.enabled,
    };
  }

  async updateSettings(
    userId: string,
    spaceId: string,
    changes: { currency?: string; lowBalance?: number; rates?: Record<string, number> },
  ): Promise<void> {
    await this.assertBudgetSpace(userId, spaceId);
    await this.ensureBudget(userId, spaceId);
    await this.db.update(budgets).set(changes).where(and(eq(budgets.spaceId, spaceId), eq(budgets.userId, userId)));
  }

  async createAccount(userId: string, input: AccountInput & { id: string; spaceId: string }): Promise<void> {
    await this.assertBudgetSpace(userId, input.spaceId);
    await this.db.insert(budgetAccounts).values({ ...input, userId });
  }

  async updateAccount(
    userId: string,
    id: string,
    changes: Partial<AccountInput>,
  ): Promise<void> {
    const updated = await this.db
      .update(budgetAccounts)
      .set(changes)
      .where(and(eq(budgetAccounts.id, id), eq(budgetAccounts.userId, userId)))
      .returning({ id: budgetAccounts.id });
    if (updated.length === 0) throw new NotFoundException('Account not found');
  }

  // Removes the account's entries too, including transfers to or from it.
  async removeAccount(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetAccounts)
      .where(and(eq(budgetAccounts.id, id), eq(budgetAccounts.userId, userId)))
      .returning({ id: budgetAccounts.id });
    if (deleted.length === 0) throw new NotFoundException('Account not found');
  }

  async createCategory(
    userId: string,
    input: { id: string; spaceId: string; name: string; kind: CategoryRow['kind'] },
  ): Promise<void> {
    await this.assertBudgetSpace(userId, input.spaceId);
    await this.db.insert(budgetCategories).values({ ...input, userId });
  }

  async updateCategory(
    userId: string,
    id: string,
    changes: { name?: string; monthlyLimit?: number | null },
  ): Promise<void> {
    const [category] = await this.db
      .select({ kind: budgetCategories.kind })
      .from(budgetCategories)
      .where(and(eq(budgetCategories.id, id), eq(budgetCategories.userId, userId)));
    if (!category) throw new NotFoundException('Category not found');
    if (category.kind === 'income' && changes.monthlyLimit) {
      throw new BadRequestException('Only spending categories can have a budget');
    }
    await this.db.update(budgetCategories).set(changes).where(eq(budgetCategories.id, id));
  }

  // Entries in the category stay, uncategorised.
  async removeCategory(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetCategories)
      .where(and(eq(budgetCategories.id, id), eq(budgetCategories.userId, userId)))
      .returning({ id: budgetCategories.id });
    if (deleted.length === 0) throw new NotFoundException('Category not found');
  }

  async createEntry(
    userId: string,
    input: EntryShape & { id: string; spaceId: string; scheduleId?: string; occurrenceDay?: string },
  ): Promise<void> {
    await this.assertBudgetSpace(userId, input.spaceId);
    await this.assertFlowRefs(userId, input.spaceId, input);
    if (input.scheduleId) await this.assertOwned(budgetSchedules, userId, input.spaceId, input.scheduleId, 'Schedule not found');
    const { id, spaceId, scheduleId = null, occurrenceDay = null } = input;
    const inserted = await this.db
      .insert(budgetEntries)
      .values({ ...this.entryColumns(input), id, spaceId, userId, scheduleId, occurrenceDay })
      .onConflictDoNothing({ target: [budgetEntries.scheduleId, budgetEntries.occurrenceDay] })
      .returning({ id: budgetEntries.id });
    if (inserted.length === 0) throw new ConflictException('That one is already recorded');
  }

  async updateEntry(userId: string, id: string, input: EntryShape): Promise<void> {
    const [entry] = await this.db
      .select({ spaceId: budgetEntries.spaceId })
      .from(budgetEntries)
      .where(and(eq(budgetEntries.id, id), eq(budgetEntries.userId, userId)));
    if (!entry) throw new NotFoundException('Entry not found');
    await this.assertFlowRefs(userId, entry.spaceId, input);
    await this.db.update(budgetEntries).set(this.entryColumns(input)).where(eq(budgetEntries.id, id));
  }

  async removeEntry(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetEntries)
      .where(and(eq(budgetEntries.id, id), eq(budgetEntries.userId, userId)))
      .returning({ id: budgetEntries.id });
    if (deleted.length === 0) throw new NotFoundException('Entry not found');
  }

  async createSchedule(userId: string, input: ScheduleShape & { id: string; spaceId: string }): Promise<void> {
    await this.assertBudgetSpace(userId, input.spaceId);
    await this.assertFlowRefs(userId, input.spaceId, input);
    await this.db.insert(budgetSchedules).values({ ...this.scheduleColumns(input), id: input.id, spaceId: input.spaceId, userId });
  }

  async updateSchedule(userId: string, id: string, input: ScheduleShape): Promise<void> {
    const [schedule] = await this.db
      .select({ spaceId: budgetSchedules.spaceId })
      .from(budgetSchedules)
      .where(and(eq(budgetSchedules.id, id), eq(budgetSchedules.userId, userId)));
    if (!schedule) throw new NotFoundException('Schedule not found');
    await this.assertFlowRefs(userId, schedule.spaceId, input);
    await this.db.update(budgetSchedules).set(this.scheduleColumns(input)).where(eq(budgetSchedules.id, id));
  }

  // Entries it already recorded stay, no longer linked to a schedule.
  async removeSchedule(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetSchedules)
      .where(and(eq(budgetSchedules.id, id), eq(budgetSchedules.userId, userId)))
      .returning({ id: budgetSchedules.id });
    if (deleted.length === 0) throw new NotFoundException('Schedule not found');
  }

  private flowColumns(input: FlowShape) {
    const { kind, amount, accountId } = input;
    return input.kind === 'transfer'
      ? { kind, amount, accountId, toAccountId: input.toAccountId, categoryId: null }
      : { kind, amount, accountId, toAccountId: null, categoryId: input.categoryId };
  }

  private entryColumns(input: EntryShape) {
    const toAmount = input.kind === 'transfer' ? (input.toAmount ?? null) : null;
    return { ...this.flowColumns(input), day: input.day, note: input.note ?? '', toAmount, icon: input.icon ?? null };
  }

  private scheduleColumns(input: ScheduleShape) {
    const { name, frequency, interval, monthDays, startDay, endDay, activeFrom, pausedFrom, skippedDays, autoRecord } = input;
    return {
      ...this.flowColumns(input),
      name,
      frequency,
      interval,
      monthDays: frequency === 'monthly' ? monthDays : [],
      startDay,
      endDay,
      activeFrom,
      pausedFrom,
      skippedDays: [...new Set(skippedDays)].sort(),
      autoRecord,
      isSubscription: input.kind === 'expense' && input.isSubscription,
      icon: input.icon ?? null,
    };
  }

  private async assertOwned(table: Owned, userId: string, spaceId: string, id: string, message: string): Promise<void> {
    const [row] = await this.db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), eq(table.spaceId, spaceId), eq(table.userId, userId)));
    if (!row) throw new NotFoundException(message);
  }

  private async assertFlowRefs(userId: string, spaceId: string, input: FlowShape): Promise<void> {
    const accountIds = input.kind === 'transfer' ? [input.accountId, input.toAccountId] : [input.accountId];
    if (new Set(accountIds).size !== accountIds.length) throw new BadRequestException('Pick two different accounts');
    const accounts = await this.db
      .select({ id: budgetAccounts.id })
      .from(budgetAccounts)
      .where(and(inArray(budgetAccounts.id, accountIds), eq(budgetAccounts.spaceId, spaceId), eq(budgetAccounts.userId, userId)));
    if (accounts.length !== accountIds.length) throw new NotFoundException('Account not found');

    if (input.kind === 'transfer' || !input.categoryId) return;
    const [category] = await this.db
      .select({ kind: budgetCategories.kind })
      .from(budgetCategories)
      .where(
        and(
          eq(budgetCategories.id, input.categoryId),
          eq(budgetCategories.spaceId, spaceId),
          eq(budgetCategories.userId, userId),
        ),
      );
    if (!category) throw new NotFoundException('Category not found');
    if (category.kind !== input.kind) throw new BadRequestException(`That category is for ${category.kind}`);
  }

  // A new budget starts with a cash account and everyday categories, so the first entry is one step away.
  private async ensureBudget(userId: string, spaceId: string) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(budgets).values({ spaceId, userId }).onConflictDoNothing().returning();
      if (!created) {
        const [existing] = await tx.select().from(budgets).where(eq(budgets.spaceId, spaceId));
        return existing;
      }
      await tx.insert(budgetAccounts).values({ id: crypto.randomUUID(), userId, spaceId, name: 'Cash', type: 'cash' });
      const startedAt = Date.now();
      await tx.insert(budgetCategories).values(
        (['expense', 'income'] as const).flatMap((kind) =>
          STARTER_CATEGORIES[kind].map((name, index) => ({
            id: crypto.randomUUID(),
            userId,
            spaceId,
            name,
            kind,
            createdAt: new Date(startedAt + (kind === 'income' ? 100 : 0) + index),
          })),
        ),
      );
      return created;
    });
  }

  private async assertBudgetSpace(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'budget'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Budget not found');
  }

  async createGoal(userId: string, input: { id: string; spaceId: string; name: string; target: number; targetDay: string | null }) {
    await this.assertBudgetSpace(userId, input.spaceId);
    await this.db.insert(budgetGoals).values({ ...input, userId });
  }

  async updateGoal(userId: string, id: string, changes: { name?: string; target?: number; targetDay?: string | null }) {
    const updated = await this.db
      .update(budgetGoals)
      .set(changes)
      .where(and(eq(budgetGoals.id, id), eq(budgetGoals.userId, userId)))
      .returning({ id: budgetGoals.id });
    if (updated.length === 0) throw new NotFoundException('Goal not found');
  }

  async removeGoal(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetGoals)
      .where(and(eq(budgetGoals.id, id), eq(budgetGoals.userId, userId)))
      .returning({ id: budgetGoals.id });
    if (deleted.length === 0) throw new NotFoundException('Goal not found');
  }

  async addContribution(userId: string, input: { id: string; goalId: string; amount: number; day: string; note: string }) {
    const [goal] = await this.db
      .select({ id: budgetGoals.id })
      .from(budgetGoals)
      .where(and(eq(budgetGoals.id, input.goalId), eq(budgetGoals.userId, userId)));
    if (!goal) throw new NotFoundException('Goal not found');
    await this.db.insert(budgetGoalContributions).values({ ...input, userId });
  }

  async removeContribution(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetGoalContributions)
      .where(and(eq(budgetGoalContributions.id, id), eq(budgetGoalContributions.userId, userId)))
      .returning({ id: budgetGoalContributions.id });
    if (deleted.length === 0) throw new NotFoundException('Contribution not found');
  }

  async saveReceipt(userId: string, entryId: string, receipt: { mediaType: string; data: string }): Promise<void> {
    await this.assertOwned(budgetEntries, userId, await this.entrySpace(userId, entryId), entryId, 'Entry not found');
    await this.db
      .insert(budgetReceipts)
      .values({ entryId, userId, ...receipt })
      .onConflictDoUpdate({ target: budgetReceipts.entryId, set: { ...receipt, createdAt: new Date() } });
  }

  async receipt(userId: string, entryId: string): Promise<{ mediaType: string; data: Buffer }> {
    const [row] = await this.db
      .select({ mediaType: budgetReceipts.mediaType, data: budgetReceipts.data })
      .from(budgetReceipts)
      .where(and(eq(budgetReceipts.entryId, entryId), eq(budgetReceipts.userId, userId)));
    if (!row) throw new NotFoundException('Receipt not found');
    return { mediaType: row.mediaType, data: Buffer.from(row.data, 'base64') };
  }

  async removeReceipt(userId: string, entryId: string): Promise<void> {
    const deleted = await this.db
      .delete(budgetReceipts)
      .where(and(eq(budgetReceipts.entryId, entryId), eq(budgetReceipts.userId, userId)))
      .returning({ entryId: budgetReceipts.entryId });
    if (deleted.length === 0) throw new NotFoundException('Receipt not found');
  }

  // A budget's categories, after checking the space is the user's budget.
  async categoriesFor(userId: string, spaceId: string, kind?: 'income' | 'expense'): Promise<{ id: string; name: string }[]> {
    await this.assertBudgetSpace(userId, spaceId);
    const rows = await this.db
      .select({ id: budgetCategories.id, name: budgetCategories.name, kind: budgetCategories.kind })
      .from(budgetCategories)
      .where(and(eq(budgetCategories.spaceId, spaceId), eq(budgetCategories.userId, userId)));
    return rows.filter((row) => !kind || row.kind === kind).map(({ id, name }) => ({ id, name }));
  }

  private async entrySpace(userId: string, entryId: string): Promise<string> {
    const [entry] = await this.db
      .select({ spaceId: budgetEntries.spaceId })
      .from(budgetEntries)
      .where(and(eq(budgetEntries.id, entryId), eq(budgetEntries.userId, userId)));
    if (!entry) throw new NotFoundException('Entry not found');
    return entry.spaceId;
  }
}
