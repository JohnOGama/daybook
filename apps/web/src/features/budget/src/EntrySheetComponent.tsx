'use client';

import { Repeat } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { DrawerCloseButtonComponent } from '@/shared/components/DrawerCloseButtonComponent';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer';
import { useActiveSpace } from '@/features/spaces';
import { cn } from '@/shared/utils/cn';
import { useBudgetMutations } from '../hooks/useBudgetMutations';
import { scanReceipt, suggestCategory } from './budget-api';
import { currencyOf, receivedAmount } from './budget-currency';
import { categoryFromHistory } from './budget-labels';
import { limitAlert } from './budget-math';
import { centsToInput, formatMoney, parseMoney } from './budget-money';
import type { Budget, BudgetEntry, EntryInput, EntryKind, ReceiptImage, ScheduleInput } from './budget-types';
import { AmountInputComponent } from './BudgetPartsComponent';
import { AccountSelectComponent, CategorySelectComponent, KindSwitchComponent, NO_CATEGORY } from './FlowFieldsComponent';
import { ReceiptFieldComponent } from './ReceiptFieldComponent';
import { brandForName } from './brand-icons';
import { BrandPickerComponent } from './BrandPickerComponent';
import { shrinkReceipt } from './receipt-image';

const SUGGEST_AFTER_MS = 700;
const HINTS = { history: 'Picked from your past entries', ai: 'Suggested by Gemini · change it if it’s wrong' };

export type EntrySheetState = { mode: 'add'; kind?: EntryKind; draft?: Partial<EntryInput> } | { mode: 'edit'; entry: BudgetEntry } | null;

type EntrySheetProps = {
  budget: Budget;
  today: string;
  state: EntrySheetState;
  onClose: () => void;
  onRepeat: (draft: Partial<ScheduleInput>) => void;
};

export function EntrySheetComponent({ budget, today, state, onClose, onRepeat }: EntrySheetProps) {
  const editing = state?.mode === 'edit' ? state.entry : undefined;
  return (
    <Drawer direction="right" open={state !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="gap-0 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-md">
        <DrawerCloseButtonComponent />
        <DrawerHeader className="border-b pr-12">
          <DrawerTitle>{editing ? 'Edit entry' : 'New entry'}</DrawerTitle>
          <DrawerDescription>
            {editing ? 'Change any detail, or delete the entry.' : 'Record money in, money out, or a move between accounts.'}
          </DrawerDescription>
        </DrawerHeader>
        {state && (
          <EntryForm
            key={editing?.id ?? 'new'}
            budget={budget}
            today={today}
            entry={editing}
            draft={state.mode === 'add' ? { kind: state.kind, ...state.draft } : undefined}
            onDone={onClose}
            onRepeat={onRepeat}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

type EntryFormProps = {
  budget: Budget;
  today: string;
  entry?: BudgetEntry;
  draft?: Partial<EntryInput>;
  onDone: () => void;
  onRepeat: (draft: Partial<ScheduleInput>) => void;
};

function EntryForm({ budget, today, entry, draft, onDone, onRepeat }: EntryFormProps) {
  const initial = entry ?? draft ?? {};
  const { addEntry, saveEntry, deleteEntryWithUndo, attachReceipt, removeReceipt } = useBudgetMutations();
  const spaceId = useActiveSpace()?.id ?? '';
  const lastAccount = initial.accountId ?? budget.entries[0]?.accountId ?? budget.accounts[0]?.id ?? '';
  const [kind, setKind] = useState<EntryKind>(initial.kind ?? 'expense');
  const [amount, setAmount] = useState(initial.amount ? centsToInput(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial.categoryId ?? NO_CATEGORY);
  // Once someone picks a category, suggestions leave it alone.
  const [categoryChosen, setCategoryChosen] = useState(Boolean(initial.categoryId));
  const [categoryHint, setCategoryHint] = useState<keyof typeof HINTS>();
  const [accountId, setAccountId] = useState(budget.accounts.some(({ id }) => id === lastAccount) ? lastAccount : (budget.accounts[0]?.id ?? ''));
  const [toAccountId, setToAccountId] = useState(initial.toAccountId ?? budget.accounts.find(({ id }) => id !== accountId)?.id ?? '');
  const [day, setDay] = useState(initial.day ?? today);
  const [note, setNote] = useState(initial.note ?? '');
  // A note like "Netflix" picks the Netflix logo, until an icon is chosen by hand.
  const [icon, setIcon] = useState(initial.icon ?? null);
  const [iconChosen, setIconChosen] = useState(Boolean(entry || initial.icon));
  const [received, setReceived] = useState(initial.toAmount ? centsToInput(initial.toAmount) : '');
  const [receivedTouched, setReceivedTouched] = useState(Boolean(initial.toAmount));
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<ReceiptImage>();
  const [receiptRemoved, setReceiptRemoved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const latestNote = useRef(note);
  latestNote.current = note;
  const hasSavedReceipt = Boolean(entry && budget.receiptEntryIds.includes(entry.id) && !receiptRemoved);
  const isTransfer = kind === 'transfer';
  const fromCurrency = currencyOf(budget, accountId);
  const toCurrency = currencyOf(budget, toAccountId);
  const crossCurrency = isTransfer && fromCurrency !== toCurrency;
  // Until it's typed, what arrives follows the exchange rates set in Settings.
  const suggestedReceived = parseMoney(amount)
    ? centsToInput(receivedAmount(budget, { amount: parseMoney(amount) as number, accountId, toAccountId, toAmount: null }))
    : '';
  const shownReceived = receivedTouched ? received : suggestedReceived;

  function switchKind(next: EntryKind) {
    setKind(next);
    if (!budget.categories.some((category) => category.id === categoryId && category.kind === next)) setCategoryId(NO_CATEGORY);
    setError(undefined);
  }

  const flow = () => ({
    kind,
    accountId,
    toAccountId: isTransfer ? toAccountId : null,
    categoryId: isTransfer || categoryId === NO_CATEGORY ? null : categoryId,
  });

  function changeNote(text: string) {
    setNote(text);
    if (!iconChosen) setIcon(brandForName(text)?.key ?? null);
  }

  function chooseCategory(id: string) {
    setCategoryId(id);
    setCategoryChosen(true);
    setCategoryHint(undefined);
  }

  // Fill the category from a matching past entry straight away, or ask Gemini once typing pauses.
  useEffect(() => {
    if (categoryChosen || kind === 'transfer' || note.trim().length < 2) return;
    const fromHistory = categoryFromHistory(budget, note, kind);
    if (fromHistory) {
      setCategoryId(fromHistory);
      setCategoryHint('history');
      return;
    }
    if (!budget.aiEnabled || note.trim().length < 3) return;
    const asked = note;
    const timer = setTimeout(() => {
      suggestCategory({ spaceId, kind, note: asked, amount: amount || 'unknown amount' })
        .then(({ categoryId: suggested }) => {
          if (suggested && latestNote.current === asked) {
            setCategoryId(suggested);
            setCategoryHint('ai');
          }
        })
        .catch(() => {});
    }, SUGGEST_AFTER_MS);
    return () => clearTimeout(timer);
  }, [note, kind, categoryChosen]);

  async function attach(file: File) {
    try {
      setReceipt(await shrinkReceipt(file));
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  async function scan(file: File) {
    setScanning(true);
    setError(undefined);
    try {
      const image = await shrinkReceipt(file);
      setReceipt(image);
      const result = await scanReceipt({ spaceId, today, ...image });
      if (kind !== 'expense') switchKind('expense');
      if (result.amount) setAmount(centsToInput(result.amount));
      if (result.day) setDay(result.day);
      if (result.merchant && !note.trim()) changeNote(result.merchant);
      if (result.categoryId) {
        setCategoryId(result.categoryId);
        setCategoryChosen(true);
        setCategoryHint('ai');
      }
      if (result.currency && result.currency !== fromCurrency) {
        setError(`This receipt is in ${result.currency}, but the account uses ${fromCurrency}. Check the amount.`);
      } else if (!result.amount) {
        setError("The total couldn't be read. Enter it yourself; the photo stays attached.");
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cents = parseMoney(amount);
    if (!cents) return setError('Enter an amount above zero.');
    if (!accountId) return setError('Pick an account.');
    if (isTransfer && (!toAccountId || toAccountId === accountId)) return setError('Pick two different accounts.');
    if (!day) return setError('Pick a date.');
    const toAmount = crossCurrency ? parseMoney(shownReceived) : null;
    if (crossCurrency && !toAmount) return setError('Enter how much arrived in the other account.');

    const fields: EntryInput = { ...flow(), amount: cents, day, note: note.trim(), toAmount, icon };
    const alert = limitAlert(budget, fields, entry?.id, today);
    const entryId = entry?.id ?? crypto.randomUUID();
    if (entry) saveEntry.mutate({ id: entryId, entry: fields });
    else addEntry.mutate({ id: entryId, entry: fields });
    if (receipt) attachReceipt.mutate({ entryId, image: receipt });
    else if (entry && receiptRemoved && budget.receiptEntryIds.includes(entry.id)) removeReceipt.mutate(entry.id);
    if (alert?.level === 'over') toast.warning(`${alert.name} is over budget by ${formatMoney(alert.amount, budget.currency)}`);
    if (alert?.level === 'near') toast(`${alert.name} is nearly at its limit · ${formatMoney(alert.amount, budget.currency)} left`);
    onDone();
  }

  function repeat() {
    const category = budget.categories.find(({ id }) => id === categoryId);
    onRepeat({
      ...flow(),
      amount: parseMoney(amount) ?? undefined,
      startDay: day,
      activeFrom: day,
      name: note.trim() || category?.name || '',
      icon,
    });
  }

  if (budget.accounts.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Add an account in Settings before recording entries.</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <KindSwitchComponent value={kind} onChange={switchKind} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-amount">Amount</Label>
          <AmountInputComponent
            id="entry-amount"
            currency={fromCurrency}
            autoFocus
            placeholder="0.00"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(undefined);
            }}
            className="h-12 text-xl font-semibold"
          />
        </div>

        {!isTransfer && (
          <div className="flex flex-col gap-1">
            <CategorySelectComponent id="entry-category" budget={budget} kind={kind} value={categoryId} onChange={chooseCategory} />
            {categoryHint && <p className="text-xs text-muted-foreground">{HINTS[categoryHint]}</p>}
          </div>
        )}

        <div className={cn('grid gap-3', isTransfer && 'grid-cols-2')}>
          <AccountSelectComponent id="entry-account" label={isTransfer ? 'From' : 'Account'} budget={budget} value={accountId} onChange={setAccountId} />
          {isTransfer && (
            <AccountSelectComponent id="entry-to-account" label="To" budget={budget} value={toAccountId} onChange={setToAccountId} />
          )}
        </div>

        {crossCurrency && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-received">Arrived as</Label>
            <AmountInputComponent
              id="entry-received"
              currency={toCurrency}
              placeholder="0.00"
              value={shownReceived}
              onChange={(event) => {
                setReceived(event.target.value);
                setReceivedTouched(true);
              }}
            />
            <p className="text-xs text-muted-foreground">What landed in the other account, after the bank's rate and fees.</p>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-day">Date</Label>
          <Input id="entry-day" type="date" value={day} onChange={(event) => setDay(event.target.value)} className="[color-scheme:dark]" />
          {day > today && <p className="text-xs text-muted-foreground">Planned. It won't change any balance until that day.</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-note">Note</Label>
          <Input id="entry-note" placeholder="Optional" maxLength={500} value={note} onChange={(event) => changeNote(event.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-icon">Icon (optional)</Label>
          <BrandPickerComponent
            id="entry-icon"
            value={icon}
            onChange={(next) => {
              setIcon(next);
              setIconChosen(true);
            }}
          />
        </div>

        {!isTransfer && (
          <ReceiptFieldComponent
            savedEntryId={hasSavedReceipt && !receipt ? entry?.id : undefined}
            hasPending={Boolean(receipt)}
            canScan={budget.aiEnabled}
            scanning={scanning}
            onAttach={attach}
            onScan={scan}
            onRemove={() => {
              setReceipt(undefined);
              setReceiptRemoved(true);
            }}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <DrawerFooter className="flex-row items-center border-t">
        {entry ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => {
              deleteEntryWithUndo(entry);
              onDone();
            }}
          >
            Delete
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="mr-auto text-muted-foreground" onClick={repeat}>
            <Repeat aria-hidden />
            Make it repeat
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{entry ? 'Save' : 'Add entry'}</Button>
      </DrawerFooter>
    </form>
  );
}
