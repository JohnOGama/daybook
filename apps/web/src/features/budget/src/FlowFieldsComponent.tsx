'use client';

import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { cn } from '@/shared/utils/cn';
import { BrandOrIconComponent } from './BrandIconComponent';
import { ENTRY_ICONS } from './budget-labels';
import type { Budget, EntryKind } from './budget-types';

const KINDS: { id: EntryKind; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
];
export const NO_CATEGORY = 'none';

export function KindSwitchComponent({ value, onChange }: { value: EntryKind; onChange: (kind: EntryKind) => void }) {
  return (
    <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1 rounded-lg border bg-sidebar p-0.5">
      {KINDS.map(({ id, label }) => {
        const Icon = ENTRY_ICONS[id];
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors',
              value === id && 'bg-background text-foreground shadow-xs',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

type CategorySelectProps = { id: string; budget: Budget; kind: EntryKind; value: string; onChange: (id: string) => void };

export function CategorySelectComponent({ id, budget, kind, value, onChange }: CategorySelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {budget.categories
            .filter((category) => category.kind === kind)
            .map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          <SelectItem value={NO_CATEGORY}>Uncategorised</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

type AccountSelectProps = { id: string; label: string; budget: Budget; value: string; onChange: (id: string) => void };

export function AccountSelectComponent({ id, label, budget, value, onChange }: AccountSelectProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Pick an account" />
        </SelectTrigger>
        <SelectContent>
          {budget.accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.icon && <BrandOrIconComponent icon={account.icon} fallback={null} className="size-4 rounded-[4px]" />}
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
