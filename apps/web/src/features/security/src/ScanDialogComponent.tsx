'use client';

import { ShieldAlert } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useSecurityMutations } from '../hooks/useSecurityMutations';
import { PhaseProgressComponent, SCAN_PHASES } from './PhaseProgressComponent';
import type { ScanResult } from './security-types';

export function ScanDialogComponent({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <ScanForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ScanForm({ onDone }: { onDone: () => void }) {
  const { scan } = useSecurityMutations();
  const [url, setUrl] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const running = scan.isPending;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // While the request is in flight, step through the known phases so the panel reflects progress; the server's real
  // per-phase counts replace this the moment it answers.
  useEffect(() => {
    if (running) {
      timer.current = setInterval(() => setActiveIndex((index) => Math.min(index + 1, SCAN_PHASES.length - 1)), 420);
    } else if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setActiveIndex(0);
    try {
      setResult(await scan.mutateAsync(url));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That scan could not be run. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Scan a URL</DialogTitle>
        <DialogDescription>Daybook fetches the page with ordinary GET requests from its own server and reports what it sees — security headers, cookies, TLS and disclosed tech. It never sends attack payloads.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scan-url">Target URL</Label>
        <Input id="scan-url" type="url" inputMode="url" autoFocus maxLength={2000} placeholder="https://example.com" value={url} onChange={(event) => setUrl(event.target.value)} className="font-mono text-[13px]" disabled={running} />
      </div>

      <label className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm">
        <Checkbox checked={authorized} onCheckedChange={(checked) => setAuthorized(checked === true)} disabled={running} className="mt-0.5" />
        <span className="text-muted-foreground">I own this target or am authorized to test it. I understand only I am responsible for the scans I run.</span>
      </label>

      {(running || result) && (
        <div className="rounded-xl border bg-sidebar p-3">
          <PhaseProgressComponent activeIndex={activeIndex} result={result?.phases ?? null} />
        </div>
      )}

      {result && (
        <p className="text-sm">
          {result.findings.length > 0 ? (
            <span className="font-medium text-foreground">Added {result.findings.length} {result.findings.length === 1 ? 'finding' : 'findings'} to the list.</span>
          ) : (
            <span className="text-muted-foreground">No issues found in the passive checks.</span>
          )}
          {!result.aiUsed && <span className="text-muted-foreground"> AI analysis is off (no Gemini key), so only the built-in checks ran.</span>}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        {result ? (
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onDone} disabled={running}>
              Cancel
            </Button>
            <Button type="submit" disabled={running || !url.trim() || !authorized}>
              <ShieldAlert aria-hidden />
              {running ? 'Scanning…' : 'Run scan'}
            </Button>
          </>
        )}
      </DialogFooter>
    </form>
  );
}
