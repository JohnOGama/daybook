'use client';

import { useState } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { useJobsMutations } from '../hooks/useJobsMutations';
import { moveTo } from './jobs-math';
import { type Job, type JobFields, type JobStatus, STATUS_LABELS, STATUS_STEPS } from './jobs-types';

function History({ job }: { job: Job }) {
  // Newest day first; on the same day, the later change first.
  const events = job.events.map((event, index) => ({ event, index })).sort((a, b) => b.event.day.localeCompare(a.event.day) || b.index - a.index);
  return (
    <ul aria-label="History" className="flex flex-col gap-2 text-sm">
      {events.map(({ event, index }) => (
        <li key={index} className="flex gap-3">
          <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">{formatShortDay(event.day)}</span>
          <span>{event.kind === 'status' ? STATUS_LABELS[event.status] : 'Followed up'}</span>
        </li>
      ))}
      <li className="flex gap-3">
        <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">{formatShortDay(job.createdAt.slice(0, 10))}</span>
        <span className="text-muted-foreground">Added</span>
      </li>
    </ul>
  );
}

// The status steps, the day a change is recorded on, the next step while interviewing, and the trail so far.
export function JobStatusCardComponent({ job, today }: { job: Job; today: string }) {
  const { saveJob } = useJobsMutations();
  const [day, setDay] = useState(today);
  const [askingNext, setAskingNext] = useState(false);
  const [nextDay, setNextDay] = useState(job.nextStepDay ?? '');
  const [nextNote, setNextNote] = useState(job.nextStepNote ?? '');

  const save = (changes: Partial<JobFields>) => saveJob.mutate({ id: job.id, changes });

  function choose(status: JobStatus) {
    if (status === 'interviewing' && job.status !== 'interviewing') return setAskingNext(true);
    setAskingNext(false);
    save(moveTo(job, status, day));
  }

  function saveNextStep() {
    const nextStep = { nextStepDay: nextDay || null, nextStepNote: nextNote.trim() || null };
    save(askingNext ? { ...moveTo(job, 'interviewing', day), ...nextStep } : nextStep);
    setAskingNext(false);
  }

  return (
    <SectionCardComponent title="Status">
      <div className="flex flex-col gap-3 px-4 pb-4">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Status"
          value={askingNext ? 'interviewing' : job.status}
          onValueChange={(next) => next && choose(next as JobStatus)}
          className="grid w-full grid-cols-4"
        >
          {STATUS_STEPS.map((step) => (
            <ToggleGroupItem key={step} value={step} className="text-xs">
              {STATUS_LABELS[step]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center justify-between gap-2">
          <Input type="date" aria-label="Status date" max={today} value={day} onChange={(event) => setDay(event.target.value)} className="h-8 w-40 text-xs" />
          <Button
            variant={job.status === 'rejected' ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={job.status === 'rejected'}
            className="text-muted-foreground"
            onClick={() => choose('rejected')}
          >
            Not accepted
          </Button>
        </div>

        {(askingNext || job.status === 'interviewing') && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <span className="text-xs font-medium">{askingNext ? 'Moving to Interviewing. Anything booked?' : 'Next step'}</span>
            <div className="flex gap-2">
              <Input type="date" aria-label="Next step date" value={nextDay} onChange={(event) => setNextDay(event.target.value)} className="h-8 w-40 text-xs" />
              <Input aria-label="Next step note" placeholder="Interview 10:00" maxLength={120} value={nextNote} onChange={(event) => setNextNote(event.target.value)} className="h-8 text-xs" />
            </div>
            <div className="flex justify-end gap-2">
              {askingNext && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAskingNext(false);
                    save(moveTo(job, 'interviewing', day));
                  }}
                >
                  Skip
                </Button>
              )}
              <Button size="sm" onClick={saveNextStep}>
                Save
              </Button>
            </div>
          </div>
        )}

        <History job={job} />
      </div>
    </SectionCardComponent>
  );
}
