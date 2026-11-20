'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { useUptimeMutations } from '../hooks/useUptimeMutations';
import type { MonitorRow, UptimeKind } from './uptime-types';

const KINDS: { value: UptimeKind; label: string }[] = [
  { value: 'web', label: 'Web app' },
  { value: 'api', label: 'API' },
];

type MonitorDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; monitor?: MonitorRow };

export function MonitorDialogComponent({ open, onOpenChange, monitor }: MonitorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed so each opening starts from the site as it is now. */}
        {open && <MonitorForm key={monitor?.id ?? 'new'} monitor={monitor} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function MonitorForm({ monitor, onDone }: { monitor?: MonitorRow; onDone: () => void }) {
  const { add, update } = useUptimeMutations();
  const [name, setName] = useState(monitor?.name ?? '');
  const [url, setUrl] = useState(monitor?.url ?? '');
  const [kind, setKind] = useState<UptimeKind>(monitor?.kind ?? 'web');
  const [error, setError] = useState<string | null>(null);
  const saving = add.isPending || update.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (monitor) await update.mutateAsync({ id: monitor.id, changes: { name, url, kind } });
      else await add.mutateAsync({ id: crypto.randomUUID(), name, url, kind });
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That could not be saved. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{monitor ? 'Edit site' : 'Add site'}</DialogTitle>
        <DialogDescription>Daybook visits it every minute from its own server.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monitor-name">Name</Label>
        <Input id="monitor-name" autoFocus maxLength={100} placeholder="Gym API" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm leading-none font-medium">Kind</span>
        <div className="flex gap-1 rounded-lg border bg-sidebar p-0.5">
          {KINDS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn('h-8 flex-1 rounded-md text-sm font-medium text-muted-foreground transition-colors', kind === value && 'bg-background text-foreground shadow-xs')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="monitor-url">URL</Label>
        <Input
          id="monitor-url"
          type="url"
          inputMode="url"
          maxLength={2000}
          placeholder={kind === 'api' ? 'https://api.example.com/api/health' : 'https://example.com'}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="font-mono text-[13px]"
        />
        <p className="text-xs text-muted-foreground">
          {kind === 'api'
            ? 'For an API, use a health route that only answers when the app and its database are working. Public addresses only.'
            : 'The page people open. Public addresses only.'}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !name.trim() || !url.trim()}>
          {monitor ? 'Save' : 'Add and check now'}
        </Button>
      </DialogFooter>
    </form>
  );
}
