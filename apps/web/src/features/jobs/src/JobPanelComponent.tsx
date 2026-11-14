'use client';

import { ExternalLink, MoreHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from '@/shared/components/ui/drawer';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/utils/cn';
import { useJobsMutations } from '../hooks/useJobsMutations';
import type { Job, JobFields, JobProfile } from './jobs-types';
import { WORK_MODE_LABELS } from './jobs-types';
import { ChoiceComponent } from './JobFormDialogComponent';
import { JobMatchCardComponent } from './JobMatchCardComponent';
import { JobStatusCardComponent } from './JobStatusCardComponent';
import { CompanyLogoComponent } from './JobsTableComponent';

const NOTES_PAUSE_MS = 800;

type TextField = 'location' | 'salary' | 'employmentType' | 'postedOn';

// A text input that saves when the owner leaves it, and only if the value changed.
function DetailField({ field, label, job, max, type = 'text', onSave }: { field: TextField; label: string; job: Job; max?: number; type?: string; onSave: (changes: Partial<JobFields>) => void }) {
  const [value, setValue] = useState(job[field] ?? '');
  const id = `job-${field}`;
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
      <Label htmlFor={id} className="font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={max}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          const next = value.trim() || null;
          if (next !== job[field]) onSave({ [field]: next });
        }}
        className="h-8"
      />
    </div>
  );
}

function Notes({ job, onSave }: { job: Job; onSave: (changes: Partial<JobFields>) => void }) {
  const [notes, setNotes] = useState(job.notes);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const save = useRef(onSave);
  save.current = onSave;

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) save.current({ notes: pending.current });
    pending.current = null;
  };
  // Closing the panel mid-sentence still keeps what was typed.
  useEffect(() => flush, []);

  return (
    <div className="flex flex-col gap-1.5 px-4 pb-4">
      <Label htmlFor="job-notes" className="sr-only">
        Notes
      </Label>
      <Textarea
        id="job-notes"
        value={notes}
        maxLength={5_000}
        rows={3}
        placeholder="Recruiter, questions to ask, anything to remember"
        onChange={(event) => {
          setNotes(event.target.value);
          pending.current = event.target.value;
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, NOTES_PAUSE_MS);
        }}
      />
    </div>
  );
}

function Description({ job, onSave }: { job: Job; onSave: (changes: Partial<JobFields>) => void }) {
  const [text, setText] = useState(job.description);
  const [expanded, setExpanded] = useState(false);
  return (
    <SectionCardComponent
      title="Job description"
      action={
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Show less' : 'Show all'}
        </Button>
      }
    >
      <div className="px-4 pb-4">
        <Label htmlFor="job-description-edit" className="sr-only">
          Job description
        </Label>
        <Textarea
          id="job-description-edit"
          value={text}
          maxLength={30_000}
          placeholder="Paste the job description"
          onChange={(event) => setText(event.target.value)}
          onBlur={() => text.trim() !== job.description && onSave({ description: text.trim() })}
          className={cn('resize-none text-muted-foreground', expanded ? 'h-96' : 'h-24')}
        />
      </div>
    </SectionCardComponent>
  );
}

type JobPanelProps = { job: Job; profile: JobProfile; aiEnabled: boolean; today: string; onClose: () => void; onAddCv: () => void };

// Lives inside a non-modal <Drawer>: the list stays usable, and picking another job swaps what the panel shows.

// One job in full: status, match, details, description and notes, in a drawer floating on the right.
export function JobPanelComponent({ job, profile, aiEnabled, today, onClose, onAddCv }: JobPanelProps) {
  const { saveJob, deleteJobWithUndo } = useJobsMutations();
  const save = (changes: Partial<JobFields>) => saveJob.mutate({ id: job.id, changes });

  return (
    <DrawerContent
      onInteractOutside={(event) => event.preventDefault()}
      className="gap-4 overflow-x-hidden overflow-y-auto overscroll-contain rounded-xl border bg-popover p-4 data-[vaul-drawer-direction=right]:inset-y-3 data-[vaul-drawer-direction=right]:right-3 data-[vaul-drawer-direction=right]:w-[calc(100%-1.5rem)] data-[vaul-drawer-direction=right]:sm:max-w-md"
    >
      <div className="flex items-start gap-3">
        <CompanyLogoComponent company={job.company} className="size-10" />
        <div className="flex min-w-0 flex-1 flex-col">
          <DrawerTitle className="text-lg tracking-tight">{job.role}</DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-x-2">
            {job.company}
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline">
                Open posting
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </DrawerDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Job actions" className="size-8">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                deleteJobWithUndo(job);
                onClose();
              }}
            >
              <Trash2 aria-hidden />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon" aria-label="Close" className="size-8">
            <X aria-hidden />
          </Button>
        </DrawerClose>
      </div>

      <JobStatusCardComponent job={job} today={today} />
      {aiEnabled && <JobMatchCardComponent job={job} profile={profile} onAddCv={onAddCv} />}

      <SectionCardComponent title="Details">
        <div className="flex flex-col gap-2 px-4 pb-4 text-sm">
          <DetailField field="location" label="Location" job={job} max={120} onSave={save} />
          <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
            <span className="text-muted-foreground">Work mode</span>
            <ChoiceComponent label="Work mode" value={job.workMode} options={WORK_MODE_LABELS} onChange={(workMode) => save({ workMode })} allowNone />
          </div>
          <DetailField field="salary" label="Salary" job={job} max={80} onSave={save} />
          <DetailField field="employmentType" label="Type" job={job} max={40} onSave={save} />
          <DetailField field="postedOn" label="Posted" job={job} type="date" onSave={save} />
        </div>
      </SectionCardComponent>

      <Description job={job} onSave={save} />

      <SectionCardComponent title="Notes">
        <Notes job={job} onSave={save} />
      </SectionCardComponent>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed p-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Tailor my CV</span>
          <span className="text-xs text-muted-foreground">Coming next</span>
        </div>
        <Button variant="outline" size="sm" disabled>
          <Sparkles aria-hidden />
          Tailor
        </Button>
      </div>
    </DrawerContent>
  );
}
