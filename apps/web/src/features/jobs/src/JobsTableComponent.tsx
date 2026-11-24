'use client';

import { ArrowDown, ChevronDown } from 'lucide-react';
import { Skeleton } from 'skullet/react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { cn } from '@/shared/utils/cn';
import { formatShortDay, relativeDayLabel } from '@/shared/utils/date-formatter';
import { useJobsMutations } from '../hooks/useJobsMutations';
import { appliedOn, bookedStep, followUp, moveTo, nudgeFor } from './jobs-math';
import { type Job, type JobProfile, type JobSort, STATUS_DOT, STATUS_LABELS, WORK_MODE_LABELS } from './jobs-types';
import { MatchRingComponent } from './MatchRingComponent';

export function StatusPillComponent({ job }: { job: Pick<Job, 'status'> }) {
  return (
    <Badge variant="outline" className="gap-1.5">
      <span aria-hidden className={cn('size-1.5 rounded-full', STATUS_DOT[job.status])} />
      {STATUS_LABELS[job.status]}
    </Badge>
  );
}

export const CompanyLogoComponent = ({ company, className }: { company: string; className?: string }) => (
  <span aria-hidden className={cn('grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold', className)}>
    {company.trim().charAt(0).toUpperCase()}
  </span>
);

const subtitle = (job: Job) => [job.company, job.location ?? (job.workMode ? WORK_MODE_LABELS[job.workMode] : null), job.salary].filter(Boolean).join(' · ');

function AppliedCell({ job, today }: { job: Job; today: string }) {
  const applied = appliedOn(job);
  const nudge = nudgeFor(job, today);
  const booked = bookedStep(job);
  const lastStatusDay = job.events.filter((event) => event.kind === 'status').at(-1)?.day;
  const second = nudge
    ? { text: `${nudge.days} days, no reply${nudge.closeIt ? ' · close it?' : ''}`, signal: true }
    : booked && booked.day >= today
      ? { text: [booked.note, relativeDayLabel(booked.day, today), booked.time].filter(Boolean).join(' · '), signal: false }
      : (job.status === 'offer' || job.status === 'rejected') && lastStatusDay
        ? { text: `${STATUS_LABELS[job.status]} ${formatShortDay(lastStatusDay)}`, signal: false }
        : null;
  return (
    <div className="flex flex-col">
      <span className={cn(!applied && 'text-muted-foreground')}>{applied ? formatShortDay(applied) : 'Not yet'}</span>
      {second && <span className={cn('text-xs', second.signal ? 'text-signal' : 'text-muted-foreground')}>{second.text}</span>}
    </div>
  );
}

function RowAction({ job, today }: { job: Job; today: string }) {
  const { saveJob } = useJobsMutations();
  const nudge = nudgeFor(job, today);
  if (job.status === 'saved') {
    return (
      <Button variant="outline" size="sm" onClick={() => saveJob.mutate({ id: job.id, changes: moveTo(job, 'applied', today) })}>
        Mark applied
      </Button>
    );
  }
  if (!nudge) return null;
  const chase = () => saveJob.mutate({ id: job.id, changes: followUp(job, today) });
  if (!nudge.closeIt) {
    return (
      <Button variant="ghost" size="sm" onClick={chase}>
        Follow up
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          Follow up
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={chase}>Follow up</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => saveJob.mutate({ id: job.id, changes: moveTo(job, 'rejected', today) })}>Mark not accepted</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortHeader({ label, sort, by, onSort, className }: { label: string; sort: JobSort; by: JobSort; onSort: (sort: JobSort) => void; className?: string }) {
  const active = sort === by;
  return (
    <TableHead aria-sort={active ? 'descending' : undefined} className={className}>
      <Button variant="ghost" size="sm" className="-ml-2.5 h-7 px-2.5 font-medium text-muted-foreground" onClick={() => onSort(active ? 'recent' : by)}>
        {label}
        {active && <ArrowDown aria-hidden />}
      </Button>
    </TableHead>
  );
}

type JobsTableProps = {
  jobs: Job[];
  empty: string;
  profile: JobProfile;
  aiEnabled: boolean;
  canEdit?: boolean;
  today: string;
  pendingUrl: string | null;
  sort: JobSort;
  onSort: (sort: JobSort) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddCv: () => void;
};

export function JobsTableComponent({ jobs, empty, profile, aiEnabled, canEdit = true, today, pendingUrl, sort, onSort, selectedId, onSelect, onAddCv }: JobsTableProps) {
  const columns = aiEnabled ? 5 : 4;
  return (
    <Table className="[&_td]:py-2.5">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Role</TableHead>
          {aiEnabled && <SortHeader label="Match" sort={sort} by="match" onSort={onSort} className="hidden md:table-cell" />}
          <TableHead className="hidden md:table-cell">Status</TableHead>
          <SortHeader label="Applied" sort={sort} by="applied" onSort={onSort} />
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendingUrl && (
          <TableRow>
            <TableCell colSpan={columns}>
              <Skeleton loading label="Reading the posting">
                <div className="flex items-center gap-3">
                  <CompanyLogoComponent company="?" />
                  <div className="flex flex-col">
                    <span className="font-medium">Senior Frontend Engineer</span>
                    <span className="text-xs">Company · Remote</span>
                  </div>
                </div>
              </Skeleton>
              <span className="mt-1 block truncate text-xs text-signal">Reading the posting…</span>
            </TableCell>
          </TableRow>
        )}
        {jobs.map((job) => (
          <TableRow key={job.id} data-state={job.id === selectedId ? 'selected' : undefined} className="cursor-pointer" onClick={() => onSelect(job.id)}>
            <TableCell className="max-w-0 w-full">
              <div className="flex items-center gap-3">
                <CompanyLogoComponent company={job.company} />
                <div className="flex min-w-0 flex-col">
                  <Button variant="link" className="h-auto justify-start truncate p-0 font-medium text-foreground" onClick={() => onSelect(job.id)}>
                    {job.role}
                  </Button>
                  <span className="truncate text-xs text-muted-foreground">{subtitle(job)}</span>
                  <span className="mt-1 md:hidden">
                    <StatusPillComponent job={job} />
                  </span>
                </div>
              </div>
            </TableCell>
            {aiEnabled && (
              <TableCell className="hidden md:table-cell" onClick={(event) => event.stopPropagation()}>
                {job.match ? (
                  <MatchRingComponent pct={job.match.pct} />
                ) : !profile.cvText && canEdit ? (
                  <Button variant="link" size="sm" aria-label="Add your CV to see the match" onClick={onAddCv} className="h-auto p-0 text-xs text-muted-foreground">
                    Add your CV
                  </Button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            )}
            <TableCell className="hidden md:table-cell">
              <StatusPillComponent job={job} />
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <AppliedCell job={job} today={today} />
            </TableCell>
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              {canEdit && <RowAction job={job} today={today} />}
            </TableCell>
          </TableRow>
        ))}
        {jobs.length === 0 && !pendingUrl && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns} className="py-10 text-center text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
