'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useJobsMutations } from '../hooks/useJobsMutations';

const MAX_CV = 20_000;

type CvDialogProps = { open: boolean; cvText: string | null; onClose: () => void };

export function CvDialogComponent({ open, cvText, onClose }: CvDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">{open && <CvForm cvText={cvText} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function CvForm({ cvText, onDone }: { cvText: string | null; onDone: () => void }) {
  const { saveCv } = useJobsMutations();
  const [text, setText] = useState(cvText ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveCv.mutate(text.trim() || null);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Your CV</DialogTitle>
        <DialogDescription>Paste your CV as plain text. The AI compares it with one job at a time to estimate how well you match.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cv-text" className="sr-only">
          Your CV
        </Label>
        <Textarea id="cv-text" value={text} maxLength={MAX_CV} rows={14} className="max-h-[55dvh]" onChange={(event) => setText(event.target.value)} />
        <span className="self-end text-xs text-muted-foreground tabular-nums">
          {text.length.toLocaleString('en-GB')} / {MAX_CV.toLocaleString('en-GB')}
        </span>
      </div>
      <DialogFooter>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
