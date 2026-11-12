import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { BudgetAiService } from './budget-ai-service.ts';
import { BudgetService } from './budget-service.ts';

describe('BudgetService', () => {
  let db: Db;
  let svc: BudgetService;
  let budget: string;
  let theirBudget: string;

  const addBudget = async (userId: string) => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Money', tool: 'budget' }).returning();
    return row.id;
  };
  const addAccount = async (name: string, spaceId = budget, userId = 'u1') => {
    const id = crypto.randomUUID();
    await svc.createAccount(userId, { id, spaceId, name, type: 'bank', openingBalance: 10_000, aprBps: null, dueDay: null, minimumPayment: null });
    return id;
  };
  const categoryNamed = async (name: string) =>
    (await svc.load('u1', budget)).categories.find((category) => category.name === name)?.id as string;

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new BudgetService(db, new BudgetAiService());
    budget = await addBudget('u1');
    theirBudget = await addBudget('u2');
  });

  it('starts a new budget with a cash account and everyday categories, once', async () => {
    const first = await svc.load('u1', budget);
    const again = await svc.load('u1', budget);
    expect(first.currency).toBe('USD');
    expect(first.accounts).toMatchObject([{ name: 'Cash', type: 'cash', openingBalance: 0 }]);
    expect(first.categories.map((category) => category.name)).toContain('Food');
    expect(first.categories.filter((category) => category.kind === 'income').map((category) => category.name)).toContain('Salary');
    expect(again.accounts).toHaveLength(1);
    expect(again.categories).toHaveLength(first.categories.length);
  });

  it('records income, expenses and transfers', async () => {
    const bank = await addAccount('Bank');
    const savings = await addAccount('Savings');
    const food = await categoryNamed('Food');
    await svc.createEntry('u1', { id: crypto.randomUUID(), spaceId: budget, kind: 'expense', amount: 1250, accountId: bank, categoryId: food, day: '2026-11-10', note: 'Lunch' });
    await svc.createEntry('u1', { id: crypto.randomUUID(), spaceId: budget, kind: 'transfer', amount: 5000, accountId: bank, toAccountId: savings, day: '2026-11-11', note: '' });
    const { entries } = await svc.load('u1', budget);
    expect(entries).toMatchObject([
      { kind: 'transfer', amount: 5000, toAccountId: savings, categoryId: null },
      { kind: 'expense', amount: 1250, categoryId: food, note: 'Lunch' },
    ]);
  });

  it('rejects a category of the wrong kind and a transfer to the same account', async () => {
    const bank = await addAccount('Bank');
    const salary = await categoryNamed('Salary');
    const entry = { id: crypto.randomUUID(), spaceId: budget, amount: 100, accountId: bank, day: '2026-11-10', note: '' };
    await expect(svc.createEntry('u1', { ...entry, kind: 'expense', categoryId: salary })).rejects.toThrow(BadRequestException);
    await expect(svc.createEntry('u1', { ...entry, kind: 'transfer', toAccountId: bank })).rejects.toThrow(BadRequestException);
  });

  it("never lets one user touch another user's budget", async () => {
    const theirAccount = await addAccount('Theirs', theirBudget, 'u2');
    await expect(svc.load('u1', theirBudget)).rejects.toThrow(NotFoundException);
    await expect(svc.updateAccount('u1', theirAccount, { name: 'Mine' })).rejects.toThrow(NotFoundException);
    await expect(
      svc.createEntry('u1', { id: crypto.randomUUID(), spaceId: budget, kind: 'income', amount: 100, accountId: theirAccount, categoryId: null, day: '2026-11-10', note: '' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('moves an edited entry between kinds and keeps entries when their category is deleted', async () => {
    const bank = await addAccount('Bank');
    const savings = await addAccount('Savings');
    const food = await categoryNamed('Food');
    const id = crypto.randomUUID();
    await svc.createEntry('u1', { id, spaceId: budget, kind: 'expense', amount: 900, accountId: bank, categoryId: food, day: '2026-11-10', note: '' });
    await svc.removeCategory('u1', food);
    expect((await svc.load('u1', budget)).entries[0]).toMatchObject({ id, categoryId: null });
    await svc.updateEntry('u1', id, { kind: 'transfer', amount: 900, accountId: bank, toAccountId: savings, day: '2026-11-10', note: '' });
    expect((await svc.load('u1', budget)).entries[0]).toMatchObject({ kind: 'transfer', toAccountId: savings });
  });

  it('removes an account together with its entries', async () => {
    const bank = await addAccount('Bank');
    await svc.createEntry('u1', { id: crypto.randomUUID(), spaceId: budget, kind: 'income', amount: 100, accountId: bank, categoryId: null, day: '2026-11-10', note: '' });
    await svc.removeAccount('u1', bank);
    const loaded = await svc.load('u1', budget);
    expect(loaded.accounts.map((account) => account.name)).toEqual(['Cash']);
    expect(loaded.entries).toEqual([]);
  });

  it('sets monthly limits only on spending categories', async () => {
    const food = await categoryNamed('Food');
    const salary = await categoryNamed('Salary');
    await svc.updateCategory('u1', food, { monthlyLimit: 40_000 });
    await expect(svc.updateCategory('u1', salary, { monthlyLimit: 100 })).rejects.toThrow(BadRequestException);
    await svc.updateCategory('u1', food, { monthlyLimit: null });
    expect((await svc.load('u1', budget)).categories.find((category) => category.id === food)?.monthlyLimit).toBeNull();
  });

  describe('schedules', () => {
    const schedule = (accountId: string, fields: Record<string, unknown> = {}) => ({
      id: crypto.randomUUID(),
      spaceId: budget,
      name: 'Rent',
      kind: 'expense' as const,
      amount: 120_000,
      accountId,
      categoryId: null,
      frequency: 'monthly' as const,
      interval: 1,
      monthDays: [1],
      startDay: '2026-01-01',
      endDay: null,
      activeFrom: '2026-01-01',
      pausedFrom: null,
      skippedDays: [],
      autoRecord: false,
      isSubscription: false,
      ...fields,
    });
    const recordOccurrence = (scheduleId: string, accountId: string, occurrenceDay: string) =>
      svc.createEntry('u1', {
        id: crypto.randomUUID(),
        spaceId: budget,
        kind: 'expense',
        amount: 120_000,
        accountId,
        categoryId: null,
        day: occurrenceDay,
        note: 'Rent',
        scheduleId,
        occurrenceDay,
      });

    it('saves, edits and lists a schedule', async () => {
      const bank = await addAccount('Bank');
      const rent = schedule(bank, { monthDays: [15, -1], skippedDays: ['2026-03-15', '2026-03-15'] });
      await svc.createSchedule('u1', rent);
      await svc.updateSchedule('u1', rent.id, { ...rent, amount: 130_000, pausedFrom: '2026-06-01' });
      expect((await svc.load('u1', budget)).schedules).toMatchObject([
        { id: rent.id, amount: 130_000, monthDays: [15, -1], skippedDays: ['2026-03-15'], pausedFrom: '2026-06-01' },
      ]);
    });

    it('records each occurrence only once', async () => {
      const bank = await addAccount('Bank');
      const rent = schedule(bank);
      await svc.createSchedule('u1', rent);
      await recordOccurrence(rent.id, bank, '2026-02-01');
      await expect(recordOccurrence(rent.id, bank, '2026-02-01')).rejects.toThrow(ConflictException);
      await recordOccurrence(rent.id, bank, '2026-03-01');
      expect((await svc.load('u1', budget)).entries.map((entry) => entry.occurrenceDay)).toEqual(['2026-03-01', '2026-02-01']);
    });

    it('keeps recorded entries when the schedule is cancelled', async () => {
      const bank = await addAccount('Bank');
      const rent = schedule(bank);
      await svc.createSchedule('u1', rent);
      await recordOccurrence(rent.id, bank, '2026-02-01');
      await svc.removeSchedule('u1', rent.id);
      const loaded = await svc.load('u1', budget);
      expect(loaded.schedules).toEqual([]);
      expect(loaded.entries).toMatchObject([{ scheduleId: null, occurrenceDay: '2026-02-01', amount: 120_000 }]);
    });

    it("refuses another user's schedule and only marks expenses as subscriptions", async () => {
      const bank = await addAccount('Bank');
      const theirAccount = await addAccount('Theirs', theirBudget, 'u2');
      const theirs = { ...schedule(theirAccount), spaceId: theirBudget };
      await svc.createSchedule('u2', theirs);
      await expect(recordOccurrence(theirs.id, bank, '2026-02-01')).rejects.toThrow(NotFoundException);
      const pay = schedule(bank, { kind: 'income', isSubscription: true, name: 'Salary' });
      await svc.createSchedule('u1', pay);
      expect((await svc.load('u1', budget)).schedules[0]).toMatchObject({ name: 'Salary', isSubscription: false });
    });
  });

  it('keeps goals and their contributions, including money taken back out', async () => {
    const goal = crypto.randomUUID();
    await svc.createGoal('u1', { id: goal, spaceId: budget, name: 'Trip', target: 200_000, targetDay: '2027-06-01' });
    await svc.addContribution('u1', { id: crypto.randomUUID(), goalId: goal, amount: 50_000, day: '2026-11-01', note: '' });
    await svc.addContribution('u1', { id: crypto.randomUUID(), goalId: goal, amount: -5_000, day: '2026-11-05', note: 'Deposit' });
    await svc.updateGoal('u1', goal, { target: 250_000 });
    const loaded = await svc.load('u1', budget);
    expect(loaded.goals).toEqual([{ id: goal, name: 'Trip', target: 250_000, targetDay: '2027-06-01' }]);
    expect(loaded.contributions.map((item) => item.amount)).toEqual([-5_000, 50_000]);
    await expect(
      svc.addContribution('u2', { id: crypto.randomUUID(), goalId: goal, amount: 100, day: '2026-11-05', note: '' }),
    ).rejects.toThrow(NotFoundException);
    await svc.removeGoal('u1', goal);
    expect((await svc.load('u1', budget)).contributions).toEqual([]);
  });

  it('stores debt details on a loan and a low-balance warning level', async () => {
    const loan = crypto.randomUUID();
    await svc.createAccount('u1', { id: loan, spaceId: budget, name: 'Car loan', type: 'loan', openingBalance: -1_200_000, aprBps: 649, dueDay: 5, minimumPayment: 35_000 });
    await svc.updateSettings('u1', budget, { lowBalance: 50_000 });
    const loaded = await svc.load('u1', budget);
    expect(loaded.lowBalance).toBe(50_000);
    expect(loaded.accounts.find((account) => account.id === loan)).toMatchObject({ type: 'loan', aprBps: 649, dueDay: 5, minimumPayment: 35_000 });
  });

  it('keeps account currencies, exchange rates and what a cross-currency transfer delivered', async () => {
    const euros = crypto.randomUUID();
    await svc.createAccount('u1', { id: euros, spaceId: budget, name: 'Euro card', type: 'bank', openingBalance: 0, aprBps: null, dueDay: null, minimumPayment: null, currency: 'EUR' });
    const bank = await addAccount('Bank');
    await svc.updateSettings('u1', budget, { rates: { EUR: 1.08 } });
    await svc.createEntry('u1', { id: crypto.randomUUID(), spaceId: budget, kind: 'transfer', amount: 10_800, accountId: bank, toAccountId: euros, toAmount: 10_000, day: '2026-11-10', note: '' });
    await svc.createEntry('u1', { id: crypto.randomUUID(), spaceId: budget, kind: 'expense', amount: 500, accountId: bank, categoryId: null, toAmount: 900, day: '2026-11-10', note: '' });
    const loaded = await svc.load('u1', budget);
    expect(loaded.rates).toEqual({ EUR: 1.08 });
    expect(loaded.accounts.find((account) => account.id === euros)?.currency).toBe('EUR');
    expect(loaded.entries.map((entry) => entry.toAmount)).toEqual(expect.arrayContaining([10_000, null]));
  });

  it("stores one receipt per entry and keeps them private to their owner", async () => {
    const bank = await addAccount('Bank');
    const entry = crypto.randomUUID();
    await svc.createEntry('u1', { id: entry, spaceId: budget, kind: 'expense', amount: 500, accountId: bank, categoryId: null, day: '2026-11-10', note: '' });
    await svc.saveReceipt('u1', entry, { mediaType: 'image/jpeg', data: Buffer.from('first').toString('base64') });
    await svc.saveReceipt('u1', entry, { mediaType: 'image/png', data: Buffer.from('second').toString('base64') });
    expect(await svc.receipt('u1', entry)).toEqual({ mediaType: 'image/png', data: Buffer.from('second') });
    expect((await svc.load('u1', budget)).receiptEntryIds).toEqual([entry]);
    await expect(svc.receipt('u2', entry)).rejects.toThrow(NotFoundException);
    await expect(svc.saveReceipt('u2', entry, { mediaType: 'image/png', data: 'aGk=' })).rejects.toThrow(NotFoundException);
    await svc.removeEntry('u1', entry);
    await expect(svc.receipt('u1', entry)).rejects.toThrow(NotFoundException);
  });

  it('keeps an optional preset icon on accounts and schedules', async () => {
    const wallet = crypto.randomUUID();
    await svc.createAccount('u1', { id: wallet, spaceId: budget, name: 'GCash', type: 'ewallet', openingBalance: 0, aprBps: null, dueDay: null, minimumPayment: null, icon: 'gcash' });
    const loaded = await svc.load('u1', budget);
    expect(loaded.accounts.find((account) => account.id === wallet)?.icon).toBe('gcash');
    expect(loaded.accounts.find((account) => account.name === 'Cash')?.icon).toBeNull();
    await svc.updateAccount('u1', wallet, { icon: null });
    expect((await svc.load('u1', budget)).accounts.find((account) => account.id === wallet)?.icon).toBeNull();

    const entry = crypto.randomUUID();
    const fields = { kind: 'expense' as const, amount: 54_900, accountId: wallet, categoryId: null, day: '2026-11-10', note: 'Netflix' };
    await svc.createEntry('u1', { id: entry, spaceId: budget, ...fields, icon: 'netflix' });
    expect((await svc.load('u1', budget)).entries[0]).toMatchObject({ id: entry, icon: 'netflix' });
    await svc.updateEntry('u1', entry, { ...fields, icon: 'spotify' });
    expect((await svc.load('u1', budget)).entries[0].icon).toBe('spotify');
  });

  it('changes the currency', async () => {
    await svc.updateSettings('u1', budget, { currency: 'PHP' });
    expect((await svc.load('u1', budget)).currency).toBe('PHP');
  });
});
