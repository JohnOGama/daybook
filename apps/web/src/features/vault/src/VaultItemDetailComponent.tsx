'use client';

import { Copy, Eye, EyeOff, FileWarning, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { cn } from '@/shared/utils/cn';
import { formatShortDate } from '@/shared/utils/date-formatter';
import { copyWithToast } from './copy-secret';
import { ITEM_ICONS } from './item-icons';
import { type ItemField, ITEM_TYPES, type VaultItem } from './vault-types';

const MIN_MASK = 8;
const MAX_MASK = 20;

export const maskValue = (value: string) => '•'.repeat(Math.min(Math.max(value.length, MIN_MASK), MAX_MASK));

export function VaultFieldRowComponent({ field, revealed, onToggle }: { field: ItemField; revealed: boolean; onToggle: () => void }) {
  const isVisible = !field.secret || revealed;

  return (
    <div className="grid min-h-12 grid-cols-[minmax(0,130px)_minmax(0,1fr)_auto] items-center gap-3 py-1.5 pr-2 pl-3.5">
      <span className="text-[13px] text-muted-foreground">{field.label}</span>
      <span className={cn('text-sm break-words tabular-nums', !isVisible && 'tracking-widest')}>
        {isVisible ? field.value : maskValue(field.value)}
      </span>
      <span className="flex">
        {field.secret && (
          <Button variant="ghost" size="icon" aria-label={`${revealed ? 'Hide' : 'Show'} ${field.label}`} onClick={onToggle}>
            {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={`Copy ${field.label}`} onClick={() => copyWithToast(field.value)}>
          <Copy aria-hidden />
        </Button>
      </span>
    </div>
  );
}

type VaultItemDetailProps = {
  item: VaultItem;
  onEdit: () => void;
  onDelete: () => void;
};

export function VaultItemDetailComponent({ item, onEdit, onDelete }: VaultItemDetailProps) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const { content } = item;
  const Icon = content ? ITEM_ICONS[content.type] : FileWarning;

  function toggle(index: number) {
    setRevealed((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  return (
    <article className="mx-auto max-w-[620px] px-4 pt-4 pb-16 md:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-card">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-2xl leading-tight font-semibold tracking-tight">
            {content?.name ?? "Can't read this item"}
          </h2>
          {content && <p className="text-[13px] text-muted-foreground">{ITEM_TYPES[content.type].label}</p>}
        </div>
        <div className="ml-auto flex shrink-0 gap-1">
          {content && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil aria-hidden />
              Edit
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      </div>

      {!content && (
        <p className="mt-6 text-sm text-muted-foreground">This item is damaged or was encrypted with a different key.</p>
      )}
      {content && content.fields.length > 0 && (
        <div className="mt-6 divide-y rounded-lg border">
          {content.fields.map((field, index) => (
            <VaultFieldRowComponent key={`${field.label}-${index}`} field={field} revealed={revealed.has(index)} onToggle={() => toggle(index)} />
          ))}
        </div>
      )}
      {content?.notes && (
        <div className="mt-5">
          <h3 className="mb-1.5 text-[13px] font-medium text-muted-foreground">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{content.notes}</p>
        </div>
      )}
      <p className="mt-5 text-xs text-muted-foreground">Updated {formatShortDate(item.updatedAt)}</p>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>It will move to Trash, still encrypted. You can restore it from there.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
