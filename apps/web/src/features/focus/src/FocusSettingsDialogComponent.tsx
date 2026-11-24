'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import type { FocusSettings } from './focus-types';

const FIELDS: { key: keyof FocusSettings; label: string; max: number }[] = [
  { key: 'focusMinutes', label: 'Focus (minutes)', max: 180 },
  { key: 'shortBreakMinutes', label: 'Short break (minutes)', max: 60 },
  { key: 'longBreakMinutes', label: 'Long break (minutes)', max: 90 },
  { key: 'longBreakEvery', label: 'Long break after (sessions)', max: 12 },
];

type FocusSettingsDialogProps = { settings: FocusSettings; onSave: (settings: FocusSettings) => void; onClose: () => void };

export function FocusSettingsDialogComponent({ settings, onSave, onClose }: FocusSettingsDialogProps) {
  const [typed, setTyped] = useState(() => Object.fromEntries(FIELDS.map(({ key }) => [key, String(settings[key])])) as Record<keyof FocusSettings, string>);
  const read = (key: keyof FocusSettings, max: number) => {
    const value = Number(typed[key]);
    return Number.isInteger(value) && value >= 1 && value <= max ? value : null;
  };
  const values = FIELDS.map(({ key, max }) => [key, read(key, max)] as const);
  const valid = values.every(([, value]) => value !== null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave(Object.fromEntries(values) as FocusSettings);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Timer lengths</DialogTitle>
          <DialogDescription>New lengths apply from the next session.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(({ key, label, max }) => (
              <label key={key} className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{label}</span>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  className="tabular-nums"
                  aria-invalid={read(key, max) === null}
                  value={typed[key]}
                  onChange={(event) => setTyped((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
