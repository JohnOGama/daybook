'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useSecurityMutations } from '../hooks/useSecurityMutations';
import { cvssToTenths, OWASP_CODES, OWASP_LABELS, SEVERITIES, SEVERITY_META, STATUS_META, STATUSES } from './security-math';
import type { FindingRow, FindingStatus, Owasp, Severity } from './security-types';

const NO_OWASP = 'none';

type FindingDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; finding?: FindingRow };

export function FindingDialogComponent({ open, onOpenChange, finding }: FindingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <FindingForm key={finding?.id ?? 'new'} finding={finding} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FindingForm({ finding, onDone }: { finding?: FindingRow; onDone: () => void }) {
  const { add, update } = useSecurityMutations();
  const [title, setTitle] = useState(finding?.title ?? '');
  const [target, setTarget] = useState(finding?.target ?? '');
  const [severity, setSeverity] = useState<Severity>(finding?.severity ?? 'medium');
  const [status, setStatus] = useState<FindingStatus>(finding?.status ?? 'open');
  const [cvss, setCvss] = useState(finding?.cvss != null ? (finding.cvss / 10).toString() : '');
  const [owasp, setOwasp] = useState<Owasp | typeof NO_OWASP>(finding?.owasp ?? NO_OWASP);
  const [description, setDescription] = useState(finding?.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const saving = add.isPending || update.isPending;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const score = cvss.trim() === '' ? null : cvssToTenths(Number(cvss));
    const fields = { title: title.trim(), target: target.trim() || null, severity, status, cvss: score, owasp: owasp === NO_OWASP ? null : owasp, description: description.trim() || null };
    try {
      if (finding) await update.mutateAsync({ id: finding.id, changes: fields });
      else await add.mutateAsync({ id: crypto.randomUUID(), ...fields });
      onDone();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'That could not be saved. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{finding ? 'Edit finding' : 'Add finding'}</DialogTitle>
        <DialogDescription>Track a vulnerability or issue by severity and status.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finding-title">Title</Label>
        <Input id="finding-title" autoFocus maxLength={200} placeholder="SQL injection in login form" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finding-target">Affected asset</Label>
        <Input id="finding-target" maxLength={2000} placeholder="https://app.example/login" value={target} onChange={(event) => setTarget(event.target.value)} className="font-mono text-[13px]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finding-severity">Severity</Label>
          <Select value={severity} onValueChange={(value) => setSeverity(value as Severity)}>
            <SelectTrigger id="finding-severity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {SEVERITY_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finding-status">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as FindingStatus)}>
            <SelectTrigger id="finding-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finding-cvss">CVSS</Label>
          <Input id="finding-cvss" type="number" inputMode="decimal" min={0} max={10} step={0.1} placeholder="0.0–10.0" value={cvss} onChange={(event) => setCvss(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finding-owasp">OWASP category</Label>
        <Select value={owasp} onValueChange={(value) => setOwasp(value as Owasp | typeof NO_OWASP)}>
          <SelectTrigger id="finding-owasp" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_OWASP}>None</SelectItem>
            {OWASP_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {code} · {OWASP_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finding-description">Notes</Label>
        <Textarea id="finding-description" maxLength={10000} rows={4} placeholder="Where it is, how to reproduce it, and the fix." value={description} onChange={(event) => setDescription(event.target.value)} />
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
        <Button type="submit" disabled={saving || !title.trim()}>
          {finding ? 'Save' : 'Add finding'}
        </Button>
      </DialogFooter>
    </form>
  );
}
