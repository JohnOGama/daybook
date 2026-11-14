'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { useJobsMutations } from '../hooks/useJobsMutations';
import { newJob, trailTo } from './jobs-math';
import { JOB_STATUSES, type JobStatus, type ReadFailure, STATUS_LABELS, WORK_MODE_LABELS, type WorkMode } from './jobs-types';

const REASONS: Record<ReadFailure, string> = {
  login: 'This site needs a login to view the posting.',
  unreadable: "Couldn't read that page.",
  notPosting: "That page doesn't look like a job posting.",
};

export type JobFormInitial = { url?: string; reason?: ReadFailure };

type ChoiceProps<T extends string> = { label: string; value: T | null; options: Record<T, string>; onChange: (value: T | null) => void; allowNone?: boolean };

// One choice from a few options; clicking the chosen one again clears it when `allowNone` is set.
export function ChoiceComponent<T extends string>({ label, value, options, onChange, allowNone }: ChoiceProps<T>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={1}
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => (next ? onChange(next as T) : allowNone && onChange(null))}
      className="flex-wrap"
    >
      {(Object.entries(options) as [T, string][]).map(([option, text]) => (
        <ToggleGroupItem key={option} value={option} className="px-2.5 text-xs">
          {text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function Field({ id, label, children }: { id?: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {id ? <Label htmlFor={id}>{label}</Label> : <span className="text-sm font-medium">{label}</span>}
      {children}
    </div>
  );
}

type JobFormDialogProps = { initial: JobFormInitial | null; today: string; onClose: () => void };

export function JobFormDialogComponent({ initial, today, onClose }: JobFormDialogProps) {
  return (
    <Dialog open={initial !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {initial && <JobForm initial={initial} today={today} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

const STATUS_OPTIONS = Object.fromEntries(JOB_STATUSES.map((status) => [status, STATUS_LABELS[status]])) as Record<JobStatus, string>;

function JobForm({ initial, today, onDone }: { initial: JobFormInitial; today: string; onDone: () => void }) {
  const { addJob } = useJobsMutations();
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [url, setUrl] = useState(initial.url ?? '');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | null>(null);
  const [salary, setSalary] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<JobStatus>('saved');
  const [day, setDay] = useState(today);
  const link = url.trim();
  const linkValid = link === '' || /^https?:\/\/\S+$/i.test(link);
  const ready = role.trim() !== '' && company.trim() !== '' && linkValid && day <= today;
  const orNull = (value: string) => value.trim() || null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    addJob.mutate(
      newJob({
        role: role.trim(),
        company: company.trim(),
        url: orNull(link),
        location: orNull(location),
        workMode,
        salary: orNull(salary),
        employmentType: orNull(employmentType),
        description: description.trim(),
        status,
        events: trailTo(status, day),
      }),
    );
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Add a job</DialogTitle>
        <DialogDescription>{initial.reason ? `${REASONS[initial.reason]} Paste the job description instead.` : 'Fill in what you know; only the role and company are needed.'}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="job-role" label="Role">
          <Input id="job-role" value={role} maxLength={200} onChange={(event) => setRole(event.target.value)} />
        </Field>
        <Field id="job-company" label="Company">
          <Input id="job-company" value={company} maxLength={200} onChange={(event) => setCompany(event.target.value)} />
        </Field>
      </div>
      <Field id="job-link" label="Link">
        <Input id="job-link" type="url" value={url} placeholder="https://" aria-invalid={!linkValid} onChange={(event) => setUrl(event.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="job-location" label="Location">
          <Input id="job-location" value={location} maxLength={120} onChange={(event) => setLocation(event.target.value)} />
        </Field>
        <Field id="job-salary" label="Salary">
          <Input id="job-salary" value={salary} maxLength={80} placeholder="$120–140k" onChange={(event) => setSalary(event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Work mode">
          <ChoiceComponent label="Work mode" value={workMode} options={WORK_MODE_LABELS} onChange={setWorkMode} allowNone />
        </Field>
        <Field id="job-type" label="Employment type">
          <Input id="job-type" value={employmentType} maxLength={40} placeholder="Full-time" onChange={(event) => setEmploymentType(event.target.value)} />
        </Field>
      </div>
      <Field id="job-description" label="Job description">
        <Textarea id="job-description" value={description} maxLength={30_000} rows={5} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field label="Status">
        <ChoiceComponent label="Status" value={status} options={STATUS_OPTIONS} onChange={(value) => setStatus(value ?? 'saved')} />
      </Field>
      {status !== 'saved' && (
        <Field id="job-day" label="Date">
          <Input id="job-day" type="date" max={today} value={day} onChange={(event) => setDay(event.target.value)} className="w-44" />
        </Field>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!ready}>
          Add job
        </Button>
      </DialogFooter>
    </form>
  );
}
