'use client';

import { Paperclip, ScanLine, X } from 'lucide-react';
import { type ChangeEvent, useId } from 'react';
import { Button } from '@/shared/components/ui/button';
import { receiptUrl } from './budget-api';

type ReceiptFieldProps = {
  savedEntryId?: string;
  hasPending: boolean;
  canScan: boolean;
  scanning: boolean;
  onAttach: (file: File) => void;
  onScan: (file: File) => void;
  onRemove: () => void;
};

// Attach a photo of the receipt, or (with Gemini set up) scan one to fill in the entry.
export function ReceiptFieldComponent({ savedEntryId, hasPending, canScan, scanning, onAttach, onScan, onRemove }: ReceiptFieldProps) {
  const attachId = useId();
  const scanId = useId();
  const pick = (handle: (file: File) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) handle(file);
  };

  if (savedEntryId || hasPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {savedEntryId ? (
          <a href={receiptUrl(savedEntryId)} target="_blank" rel="noreferrer" className="flex-1 underline underline-offset-2 hover:text-foreground">
            View receipt
          </a>
        ) : (
          <span className="flex-1">Photo attached</span>
        )}
        <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Remove receipt" onClick={onRemove}>
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input id={attachId} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick(onAttach)} />
      <Button type="button" variant="outline" size="sm" asChild>
        <label htmlFor={attachId} className="cursor-pointer">
          <Paperclip aria-hidden />
          Attach receipt
        </label>
      </Button>
      {canScan && (
        <>
          <input id={scanId} type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanning} onChange={pick(onScan)} />
          <Button type="button" variant="outline" size="sm" asChild disabled={scanning}>
            <label htmlFor={scanId} className="cursor-pointer" aria-disabled={scanning}>
              <ScanLine aria-hidden />
              {scanning ? 'Reading receipt…' : 'Scan receipt'}
            </label>
          </Button>
        </>
      )}
    </div>
  );
}
