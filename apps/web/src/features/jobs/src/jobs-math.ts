import { addDays } from '@/shared/utils/date-formatter';
import { type Job, type JobEvent, type JobFields, type JobProfile, type JobSort, type JobStatus, STATUS_LABELS } from './jobs-types';

const NUDGE_FROM_DAYS = 7;
const CLOSE_IT_FROM_DAYS = 30;
const WAITING_LONG_DAYS = 14;
const REPLIED: JobStatus[] = ['interviewing', 'offer', 'rejected'];

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
const latest = (days: string[]) => days.reduce<string | null>((most, day) => (most === null || day > most ? day : most), null);
const earliest = (days: string[]) => days.reduce<string | null>((least, day) => (least === null || day < least ? day : least), null);
const statusDays = (job: Job, statuses: JobStatus[]) =>
  job.events.filter((event) => event.kind === 'status' && statuses.includes(event.status)).map(({ day }) => day);

export const appliedOn = (job: Job): string | null => earliest(statusDays(job, ['applied']));

export const lastActivityDay = (job: Job): string => latest(job.events.map(({ day }) => day)) ?? job.createdAt.slice(0, 10);

// Days since the owner last heard nothing back: from applying, or from their latest follow-up.
export function waitingDays(job: Job, today: string): number | null {
  if (job.status !== 'applied') return null;
  const since = latest([...statusDays(job, ['applied']), ...job.events.filter(({ kind }) => kind === 'followUp').map(({ day }) => day)]);
  return since === null ? null : Math.max(0, dayNumber(today) - dayNumber(since));
}

export function nudgeFor(job: Job, today: string): { days: number; closeIt: boolean } | null {
  const days = waitingDays(job, today);
  return days !== null && days >= NUDGE_FROM_DAYS ? { days, closeIt: days >= CLOSE_IT_FROM_DAYS } : null;
}

export function moveTo(job: Job, status: JobStatus, day: string): Pick<Job, 'status' | 'events'> {
  if (job.status === status) return { status, events: job.events };
  return { status, events: [...job.events, { kind: 'status', status, day }] };
}

// The booked next step (an interview, usually) only counts while the job is in Interviewing. One kept after moving
// on to Offer or Not accepted is history, so it never shows as upcoming.
export function bookedStep(job: Job): { day: string; note: string | null; time: string | null } | null {
  return job.status === 'interviewing' && job.nextStepDay ? { day: job.nextStepDay, note: job.nextStepNote, time: stepTime(job.nextStepAt) } : null;
}

// A day and a typed time ("09:30") as one moment, read in the browser's own time zone; no time, no moment.
export const stepInstant = (day: string | null, time: string): string | null => (day && time ? new Date(`${day}T${time}`).toISOString() : null);

// The local "HH:MM" of a stored moment.
export function stepTime(at: string | null): string | null {
  if (!at) return null;
  const date = new Date(at);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export type CalendarEntry = { jobId: string; day: string; kind: 'interview' | 'status' | 'followUp'; label: string; status?: JobStatus };

// What a job hunt calendar shows: booked interviews, every status change and every follow-up, by day.
export function calendarEntries(jobs: Job[]): CalendarEntry[] {
  return jobs.flatMap((job) => {
    const booked = bookedStep(job);
    const interview: CalendarEntry[] = booked
      ? [{ jobId: job.id, day: booked.day, kind: 'interview', label: [job.company, booked.time, booked.note ?? 'Interview'].filter(Boolean).join(' · ') }]
      : [];
    const history: CalendarEntry[] = job.events.map((event) =>
      event.kind === 'status'
        ? { jobId: job.id, day: event.day, kind: 'status', status: event.status, label: `${job.company} · ${STATUS_LABELS[event.status]}` }
        : { jobId: job.id, day: event.day, kind: 'followUp', label: `${job.company} · Followed up` },
    );
    return [...interview, ...history];
  });
}

export const followUp = (job: Job, day: string): Pick<Job, 'events'> => ({ events: [...job.events, { kind: 'followUp', day }] });

const TRAILS: Record<JobStatus, JobStatus[]> = {
  saved: [],
  applied: ['applied'],
  interviewing: ['applied', 'interviewing'],
  offer: ['applied', 'interviewing', 'offer'],
  rejected: ['applied', 'rejected'],
};

export const trailTo = (status: JobStatus, day: string): JobEvent[] => TRAILS[status].map((step) => ({ kind: 'status', status: step, day }));

export function jobStats(jobs: Job[], today: string) {
  const appliedDays = jobs.map(appliedOn);
  const within = (days: number) => appliedDays.filter((day) => day !== null && day > addDays(today, -days) && day <= today).length;
  const waiting = jobs.filter((job) => job.status === 'applied');
  const everApplied = jobs.filter((job) => appliedOn(job) !== null);
  const replied = everApplied.filter((job) => statusDays(job, REPLIED).length > 0);
  const upcoming = jobs
    .flatMap((job) => {
      const booked = bookedStep(job);
      return booked && booked.day >= today ? [{ job, ...booked }] : [];
    })
    .sort((a, b) => a.day.localeCompare(b.day))[0];
  const now = (status: JobStatus) => replied.filter((job) => job.status === status).length;
  return {
    appliedWeek: within(7),
    appliedMonth: within(30),
    waiting: waiting.length,
    waitingLong: waiting.filter((job) => (waitingDays(job, today) ?? 0) >= WAITING_LONG_DAYS).length,
    interviewing: jobs.filter((job) => job.status === 'interviewing').length,
    nextStep: upcoming ?? null,
    everApplied: everApplied.length,
    replyRate: everApplied.length === 0 ? null : replied.length / everApplied.length,
    replied: { interviewing: now('interviewing'), offer: now('offer'), rejected: now('rejected') },
  };
}

export function countByStatus(jobs: Job[]): Record<JobStatus | 'all', number> {
  const counts = { all: jobs.length, saved: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 };
  for (const job of jobs) counts[job.status] += 1;
  return counts;
}

const descending = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : b.localeCompare(a));

const SORTS: Record<JobSort, (a: Job, b: Job) => number> = {
  recent: (a, b) => descending(lastActivityDay(a), lastActivityDay(b)) || b.createdAt.localeCompare(a.createdAt),
  applied: (a, b) => descending(appliedOn(a), appliedOn(b)),
  match: (a, b) => (b.match?.pct ?? -1) - (a.match?.pct ?? -1),
};

export function visibleJobs(jobs: Job[], { status, query, sort }: { status: JobStatus | 'all'; query: string; sort: JobSort }): Job[] {
  const words = query.trim().toLowerCase();
  return jobs
    .filter((job) => status === 'all' || job.status === status)
    .filter((job) => words === '' || `${job.role} ${job.company}`.toLowerCase().includes(words))
    .sort(SORTS[sort]);
}

// One posting under one key, whatever tracking, case or trailing slash the link came with.
export function normalizeLink(link: string): string {
  try {
    const url = new URL(link.trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    url.pathname = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname}${url.search}`;
  } catch {
    return link.trim();
  }
}

export const isMatchStale = (job: Job, profile: JobProfile): boolean =>
  Boolean(job.match && profile.cvUpdatedAt && job.match.matchedAt < profile.cvUpdatedAt);

// A new job as the browser creates it: ids and times are made here so the cache can show it straight away.
export function newJob(fields: Partial<JobFields> & Pick<JobFields, 'role' | 'company'>): Job {
  const now = new Date().toISOString();
  return {
    url: null,
    location: null,
    workMode: null,
    salary: null,
    employmentType: null,
    postedOn: null,
    description: '',
    notes: '',
    status: 'saved',
    events: [],
    nextStepDay: null,
    nextStepNote: null,
    nextStepAt: null,
    ...fields,
    id: crypto.randomUUID(),
    match: null,
    createdAt: now,
    updatedAt: now,
  };
}
