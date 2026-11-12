'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { ACCOUNT_ICONS } from './budget-labels';
import { centsToInput, parseMoney } from './budget-money';
import { ACCOUNT_TYPES, type AccountType, type Budget, type BudgetAccount, DEBT_TYPES } from './budget-types';
import { brandForName } from './brand-icons';
import { BrandPickerComponent } from './BrandPickerComponent';
import { AmountInputComponent } from './BudgetPartsComponent';
import { CurrencySelectComponent } from './CurrencySelectComponent';

const NO_DUE_DAY = 'none';

type AccountDialogProps = { budget: Budget; account?: BudgetAccount | 'new'; defaultType?: AccountType; onClose: () => void };

export function AccountDialogComponent({ budget, account, defaultType, onClose }: AccountDialogProps) {
  return (
    <Dialog open={account !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {account && (
          <AccountForm
            key={account === 'new' ? 'new' : account.id}
            budget={budget}
            account={account === 'new' ? undefined : account}
            defaultType={defaultType}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type AccountFormProps = { budget: Budget; account?: BudgetAccount; defaultType?: AccountType; onDone: () => void };

function AccountForm({ budget, account, defaultType, onDone }: AccountFormProps) {
  const { addAccount, saveAccount } = useBudgetMutations();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? defaultType ?? 'bank');
  const [opening, setOpening] = useState(account ? centsToInput(account.openingBalance) : '');
  const [apr, setApr] = useState(account?.aprBps != null ? String(account.aprBps / 100) : '');
  const [dueDay, setDueDay] = useState(account?.dueDay != null ? String(account.dueDay) : NO_DUE_DAY);
  const [minimum, setMinimum] = useState(account?.minimumPayment ? centsToInput(account.minimumPayment) : '');
  const [currency, setCurrency] = useState(account?.currency ?? budget.currency);
  const [icon, setIcon] = useState(account?.icon ?? null);
  // Naming an account "GCash" picks the GCash logo, until an icon is chosen by hand.
  const [iconChosen, setIconChosen] = useState(Boolean(account));
  const [error, setError] = useState<string>();
  const isDebt = DEBT_TYPES.includes(type);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const typedOpening = opening.trim() === '' ? 0 : parseMoney(opening, { allowNegative: true });
    const aprValue = apr.trim() === '' ? null : Number(apr);
    const minimumPayment = minimum.trim() === '' ? null : parseMoney(minimum);
    if (!name.trim()) return setError('Give the account a name.');
    if (typedOpening === null) return setError('Enter the starting balance as a number.');
    if (isDebt && aprValue !== null && !(aprValue >= 0 && aprValue <= 1000)) return setError('Enter the interest rate as a percentage, like 19.99.');
    if (isDebt && minimum.trim() !== '' && !minimumPayment) return setError('Enter the minimum payment as a number above zero.');
    // A debt's balance is what's owed, so people type it as a positive number and it's stored below zero.
    const openingBalance = isDebt && account === undefined ? -Math.abs(typedOpening) : typedOpening;
    const fields = {
      name: name.trim(),
      type,
      openingBalance,
      aprBps: isDebt && aprValue !== null ? Math.round(aprValue * 100) : null,
      dueDay: isDebt && dueDay !== NO_DUE_DAY ? Number(dueDay) : null,
      minimumPayment: isDebt ? minimumPayment : null,
      currency: currency === budget.currency ? null : currency,
      icon,
    };
    if (account) saveAccount.mutate({ id: account.id, ...fields });
    else addAccount.mutate({ id: crypto.randomUUID(), ...fields });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{account ? 'Edit account' : 'Add account'}</DialogTitle>
        <DialogDescription>Cash, bank, savings, e-wallet, a credit card or a loan.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-[1fr_10rem] gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-name">Name</Label>
          <Input id="account-name" autoFocus maxLength={80} value={name} onChange={(event) => {
              setName(event.target.value);
              if (!iconChosen) setIcon(brandForName(event.target.value)?.key ?? null);
            }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-type">Type</Label>
          <Select value={type} onValueChange={(value) => setType(value as AccountType)}>
            <SelectTrigger id="account-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map(({ id, label }) => {
                const Icon = ACCOUNT_ICONS[id];
                return (
                  <SelectItem key={id} value={id}>
                    <Icon aria-hidden />
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-icon">Icon (optional)</Label>
        <BrandPickerComponent
          id="account-icon"
          value={icon}
          groups={['Banks & e-wallets', 'Shopping & food']}
          onChange={(next) => {
            setIcon(next);
            setIconChosen(true);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-currency">Currency</Label>
        <CurrencySelectComponent id="account-currency" value={currency} onChange={setCurrency} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-opening">{isDebt ? (account ? 'Starting balance' : 'Amount owed') : 'Starting balance'}</Label>
        <AmountInputComponent id="account-opening" currency={currency} placeholder="0.00" value={opening} onChange={(event) => setOpening(event.target.value)} />
        <p className="text-xs text-muted-foreground">
          {isDebt
            ? account
              ? 'What you owed before your first entry, as a negative number.'
              : 'What you owe right now. Payments and new charges are recorded as entries.'
            : 'What the account held before your first entry.'}
        </p>
      </div>
      {isDebt && (
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-apr">Interest %</Label>
            <Input id="account-apr" inputMode="decimal" placeholder="19.99" value={apr} onChange={(event) => setApr(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-due">Due day</Label>
            <Select value={dueDay} onValueChange={setDueDay}>
              <SelectTrigger id="account-due" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NO_DUE_DAY}>None</SelectItem>
                {Array.from({ length: 31 }, (_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {index + 1}
                  </SelectItem>
                ))}
                <SelectItem value="-1">Last day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-minimum">Minimum</Label>
            <AmountInputComponent id="account-minimum" currency={currency} placeholder="0.00" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{account ? 'Save' : 'Add account'}</Button>
      </DialogFooter>
    </form>
  );
}
