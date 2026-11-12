'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { InlineTitleInputComponent } from '@/shared/components/InlineTitleInputComponent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { accountBalances } from './budget-math';
import { currencyOf } from './budget-currency';
import { CurrencySelectComponent } from './CurrencySelectComponent';
import { formatMoney } from './budget-money';
import { ACCOUNT_TYPES, type Budget, type BudgetAccount, type CategoryKind } from './budget-types';
import { AccountDialogComponent } from './AccountDialogComponent';
import { AccountIconComponent } from './BrandIconComponent';
import { AmountInputComponent } from './BudgetPartsComponent';
import type { BudgetViewProps } from './BudgetOverviewComponent';
import { SectionCardComponent } from './BudgetPartsComponent';

type Pending = { kind: 'account'; account: BudgetAccount } | { kind: 'category'; id: string; name: string };

export function BudgetSettingsComponent({ budget, today }: BudgetViewProps) {
  const { saveSettings, removeAccount, removeCategory } = useBudgetMutations();
  const [accountForm, setAccountForm] = useState<BudgetAccount | 'new'>();
  const [pendingDelete, setPendingDelete] = useState<Pending>();
  const balances = accountBalances(budget, today);
  const entryCount = (accountId: string) =>
    budget.entries.filter((entry) => entry.accountId === accountId || entry.toAccountId === accountId).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <SectionCardComponent title="Currency">
          <div className="flex flex-col gap-1.5 px-4 pb-4">
            <CurrencySelectComponent label="Budget currency" value={budget.currency} onChange={(currency) => saveSettings.mutate({ currency })} />
            <p className="text-xs text-muted-foreground">
              Totals, budgets and reports use this currency. Accounts can each have their own; changing this doesn't convert any amounts.
            </p>
          </div>
        </SectionCardComponent>

        <ExchangeRates budget={budget} onSave={(rates) => saveSettings.mutate({ rates })} />

        <SectionCardComponent
          title="Accounts"
          action={
            <Button variant="ghost" size="sm" onClick={() => setAccountForm('new')}>
              <Plus aria-hidden />
              Add account
            </Button>
          }
        >
          <ul className="flex flex-col px-2 pb-2">
            {budget.accounts.map((account) => {
              return (
                <li key={account.id} className="group/row flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent">
                  <AccountIconComponent account={account} className="size-9" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {ACCOUNT_TYPES.find(({ id }) => id === account.type)?.label}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{formatMoney(balances.get(account.id) ?? 0, currencyOf(budget, account.id))}</span>
                  <Button variant="ghost" size="icon" aria-label={`Edit ${account.name}`} onClick={() => setAccountForm(account)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${account.name}`}
                    onClick={() => setPendingDelete({ kind: 'account', account })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
            {budget.accounts.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Add an account to start recording.</li>}
          </ul>
        </SectionCardComponent>
      </div>

      <div className="flex flex-col gap-4">
        <CategoryList budget={budget} kind="expense" title="Spending categories" onDelete={(id, name) => setPendingDelete({ kind: 'category', id, name })} />
        <CategoryList budget={budget} kind="income" title="Income categories" onDelete={(id, name) => setPendingDelete({ kind: 'category', id, name })} />
      </div>

      <AccountDialogComponent budget={budget} account={accountForm} onClose={() => setAccountForm(undefined)} />

      <AlertDialog open={pendingDelete !== undefined} onOpenChange={(open) => !open && setPendingDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.kind === 'account' ? pendingDelete.account.name : pendingDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'account'
                ? `This also deletes its ${entryCount(pendingDelete.account.id)} entries, including transfers to or from it. This can't be undone.`
                : 'Its entries stay and become uncategorised. Its monthly limit is removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete?.kind === 'account') removeAccount.mutate(pendingDelete.account.id);
                if (pendingDelete?.kind === 'category') removeCategory.mutate(pendingDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type CategoryListProps = { budget: Budget; kind: CategoryKind; title: string; onDelete: (id: string, name: string) => void };

function CategoryList({ budget, kind, title, onDelete }: CategoryListProps) {
  const { addCategory, saveCategory } = useBudgetMutations();
  const [renamingId, setRenamingId] = useState<string>();
  const [newName, setNewName] = useState('');
  const categories = budget.categories.filter((category) => category.kind === kind);

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addCategory.mutate({ id: crypto.randomUUID(), name, kind });
    setNewName('');
  }

  return (
    <SectionCardComponent title={title}>
      <ul className="flex flex-col px-2">
        {categories.map((category) => (
          <li key={category.id} className="flex min-h-10 items-center gap-2 rounded-lg px-2 hover:bg-accent">
            {renamingId === category.id ? (
              <InlineTitleInputComponent
                label={`Name of ${category.name}`}
                value={category.name}
                onSave={(name) => saveCategory.mutate({ id: category.id, name })}
                onClose={() => setRenamingId(undefined)}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate py-2 text-left text-sm"
                onClick={() => setRenamingId(category.id)}
                aria-label={`Rename ${category.name}`}
              >
                {category.name}
              </button>
            )}
            <Button variant="ghost" size="icon" aria-label={`Delete ${category.name}`} onClick={() => onDelete(category.id, category.name)}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="flex gap-2 p-4 pt-2">
        <Input
          aria-label={`New ${kind === 'expense' ? 'spending' : 'income'} category`}
          placeholder="New category"
          maxLength={80}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={!newName.trim()}>
          Add
        </Button>
      </form>
    </SectionCardComponent>
  );
}

// One rate per currency an account uses, entered by hand: how much one unit is worth in the budget's currency.
function ExchangeRates({ budget, onSave }: { budget: Budget; onSave: (rates: Record<string, number>) => void }) {
  const foreign = [...new Set(budget.accounts.map((account) => account.currency).filter((code): code is string => Boolean(code) && code !== budget.currency))];
  if (foreign.length === 0) return null;

  function save(code: string, text: string) {
    const rate = Number(text.replace(/,/g, ''));
    if (!(rate > 0) || rate === budget.rates[code]) return;
    onSave({ ...budget.rates, [code]: rate });
  }

  return (
    <SectionCardComponent title="Exchange rates">
      <ul className="flex flex-col gap-2 px-4 pb-4">
        {foreign.map((code) => (
          <li key={code} className="flex items-center gap-3 text-sm">
            <label htmlFor={`rate-${code}`} className="w-20 shrink-0 font-medium">
              1 {code} =
            </label>
            <div className="flex-1">
              <AmountInputComponent
                id={`rate-${code}`}
                currency={budget.currency}
                defaultValue={budget.rates[code] ?? ''}
                placeholder="Set a rate"
                aria-invalid={!budget.rates[code]}
                onBlur={(event) => save(code, event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
              />
            </div>
          </li>
        ))}
        <li className="text-xs text-muted-foreground">Used to add these accounts into your totals. A missing rate counts as 1.</li>
      </ul>
    </SectionCardComponent>
  );
}
