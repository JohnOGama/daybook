import { describe, expect, it } from 'vitest';
import {
  appliedOn,
  bookedStep,
  calendarEntries,
  countByStatus,
  followUp,
  isMatchStale,
  jobStats,
  lastActivityDay,
  moveTo,
  normalizeLink,
  nudgeFor,
  trailTo,
  visibleJobs,
  waitingDays,
} from './jobs-math';
import type { Job, JobEvent, JobStatus } from './jobs-types';

const TODAY = '2026-11-14';
const applied = (day: string): JobEvent => ({ kind: 'status', status: 'applied', day });

let next = 0;
const job = (overrides: Partial<Job> = {}): Job => ({
  id: `j${next++}`,
  role: 'Frontend Engineer',
  company: 'Acme',
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
  match: null,
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-01T09:00:00.000Z',
  ...overrides,
});

describe('appliedOn and lastActivityDay', () => {
  it('reads days, not the order events were recorded in', () => {
    const backDated = job({ status: 'interviewing', events: [applied('2026-11-03'), { kind: 'status', status: 'interviewing', day: '2026-11-10' }, applied('2026-11-01')] });
    expect(appliedOn(backDated)).toBe('2026-11-01');
    expect(lastActivityDay(backDated)).toBe('2026-11-10');
  });

  it('falls back to the day the job was added', () => {
    expect(appliedOn(job())).toBeNull();
    expect(lastActivityDay(job())).toBe('2026-11-01');
  });
});

describe('waiting and the nudge', () => {
  it('counts days since applying, and a follow-up starts the count again', () => {
    const quiet = job({ status: 'applied', events: [applied('2026-11-03')] });
    expect(waitingDays(quiet, TODAY)).toBe(11);
    expect(nudgeFor(quiet, TODAY)).toEqual({ days: 11, closeIt: false });
    const chased = { ...quiet, ...followUp(quiet, '2026-11-12') };
    expect(waitingDays(chased, TODAY)).toBe(2);
    expect(nudgeFor(chased, TODAY)).toBeNull();
  });

  it('suggests closing it after 30 days, and never nudges a job that has moved on', () => {
    expect(nudgeFor(job({ status: 'applied', events: [applied('2026-10-10')] }), TODAY)).toEqual({ days: 35, closeIt: true });
    const interviewing = job({ status: 'interviewing', events: [applied('2026-10-10')] });
    expect(waitingDays(interviewing, TODAY)).toBeNull();
    expect(nudgeFor(interviewing, TODAY)).toBeNull();
  });
});

describe('moving a job', () => {
  it('adds one status event, and changes nothing when the status is the same', () => {
    const saved = job();
    expect(moveTo(saved, 'applied', TODAY)).toEqual({ status: 'applied', events: [applied(TODAY)] });
    const already = job({ status: 'applied', events: [applied('2026-11-03')] });
    expect(moveTo(already, 'applied', TODAY).events).toBe(already.events);
  });

  it('builds the trail up to a status picked when adding by hand', () => {
    expect(trailTo('saved', TODAY)).toEqual([]);
    expect(trailTo('offer', TODAY).map((event) => event.kind === 'status' && event.status)).toEqual(['applied', 'interviewing', 'offer']);
    expect(trailTo('rejected', TODAY).map((event) => event.kind === 'status' && event.status)).toEqual(['applied', 'rejected']);
    expect(trailTo('offer', TODAY).every((event) => event.day === TODAY)).toBe(true);
  });
});

describe('jobStats', () => {
  const status = (value: JobStatus, day: string, extra: Partial<Job> = {}) =>
    job({ status: value, events: value === 'saved' ? [] : [applied(day), ...(value === 'applied' ? [] : [{ kind: 'status' as const, status: value, day }])], ...extra });
  const jobs = [
    status('applied', '2026-11-12'),
    status('applied', '2026-10-25'),
    status('applied', '2026-10-29'),
    status('interviewing', '2026-11-10', { company: 'Soon', nextStepDay: '2026-11-15', nextStepNote: 'Interview 10:00' }),
    status('interviewing', '2026-11-05', { company: 'Past', nextStepDay: '2026-11-13' }),
    status('offer', '2026-11-01'),
    status('rejected', '2026-10-20'),
    status('saved', ''),
  ];

  it('counts the search as a whole', () => {
    const stats = jobStats(jobs, TODAY);
    expect(stats).toMatchObject({ appliedWeek: 2, appliedMonth: 7, waiting: 3, waitingLong: 2, interviewing: 2, everApplied: 7 });
    expect(stats.nextStep).toMatchObject({ day: '2026-11-15', note: 'Interview 10:00' });
    expect(stats.nextStep?.job.company).toBe('Soon');
    expect(stats.replied).toEqual({ interviewing: 2, offer: 1, rejected: 1 });
    expect(stats.replyRate).toBeCloseTo(4 / 7);
  });

  it('has no reply rate before anything is applied for', () => {
    expect(jobStats([job()], TODAY).replyRate).toBeNull();
    expect(jobStats([], TODAY)).toMatchObject({ appliedWeek: 0, waiting: 0, nextStep: null, replyRate: null });
  });

  it('counts each status and the total', () => {
    expect(countByStatus(jobs)).toEqual({ all: 8, saved: 1, applied: 3, interviewing: 2, offer: 1, rejected: 1 });
  });
});

describe('visibleJobs', () => {
  const acme = job({ role: 'Frontend Engineer', company: 'Acme', status: 'applied', events: [applied('2026-11-03')], match: { pct: 70, summary: '', skillsHave: [], skillsMissing: [], matchedAt: '2026-11-04T00:00:00.000Z' } });
  const globex = job({ role: 'React Engineer', company: 'Globex', status: 'saved', createdAt: '2026-11-12T00:00:00.000Z' });
  const hooli = job({ role: 'UI Lead', company: 'Hooli', status: 'applied', events: [applied('2026-11-08')], match: { pct: 90, summary: '', skillsHave: [], skillsMissing: [], matchedAt: '2026-11-09T00:00:00.000Z' } });
  const all = [acme, globex, hooli];

  it('filters by status and by role or company, ignoring case', () => {
    expect(visibleJobs(all, { status: 'applied', query: '', sort: 'recent' }).map((row) => row.company)).toEqual(['Hooli', 'Acme']);
    expect(visibleJobs(all, { status: 'all', query: 'acme', sort: 'recent' }).map((row) => row.company)).toEqual(['Acme']);
    expect(visibleJobs(all, { status: 'all', query: 'REACT', sort: 'recent' }).map((row) => row.company)).toEqual(['Globex']);
  });

  it('sorts by latest activity, by applied day, or by match with unmatched jobs last', () => {
    expect(visibleJobs(all, { status: 'all', query: '', sort: 'recent' }).map((row) => row.company)).toEqual(['Globex', 'Hooli', 'Acme']);
    expect(visibleJobs(all, { status: 'all', query: '', sort: 'applied' }).map((row) => row.company)).toEqual(['Hooli', 'Acme', 'Globex']);
    expect(visibleJobs(all, { status: 'all', query: '', sort: 'match' }).map((row) => row.company)).toEqual(['Hooli', 'Acme', 'Globex']);
  });
});

describe('normalizeLink and isMatchStale', () => {
  it('treats the same posting with tracking, case or a trailing slash as one link', () => {
    expect(normalizeLink('https://Jobs.Example.com/a/?utm_source=x&id=2#top')).toBe(normalizeLink('https://jobs.example.com/a?id=2'));
    expect(normalizeLink('https://jobs.example.com/a?id=2')).not.toBe(normalizeLink('https://jobs.example.com/a?id=3'));
    expect(normalizeLink('not a link ')).toBe('not a link');
  });

  it('says a match is stale once the CV changed after it', () => {
    const matched = job({ match: { pct: 80, summary: '', skillsHave: [], skillsMissing: [], matchedAt: '2026-11-10T00:00:00.000Z' } });
    expect(isMatchStale(matched, { cvText: 'cv', cvUpdatedAt: '2026-11-12T00:00:00.000Z' })).toBe(true);
    expect(isMatchStale(matched, { cvText: 'cv', cvUpdatedAt: '2026-11-09T00:00:00.000Z' })).toBe(false);
    expect(isMatchStale(job(), { cvText: 'cv', cvUpdatedAt: '2026-11-12T00:00:00.000Z' })).toBe(false);
  });
});

it('counts a booked next step only while the job is in Interviewing', () => {
  const interviewing = job({ status: 'interviewing', nextStepDay: '2026-11-19', nextStepNote: 'Panel 10:00' });
  expect(bookedStep(interviewing)).toEqual({ day: '2026-11-19', note: 'Panel 10:00', time: null });
  expect(bookedStep({ ...interviewing, nextStepAt: new Date('2026-11-19T10:00').toISOString() })?.time).toBe('10:00');
  expect(bookedStep({ ...interviewing, status: 'rejected' })).toBeNull();
  expect(jobStats([{ ...interviewing, status: 'offer' }], TODAY).nextStep).toBeNull();
  expect(jobStats([interviewing], TODAY).nextStep).toMatchObject({ day: '2026-11-19', note: 'Panel 10:00' });
});

it('puts interviews, status changes and follow-ups on the calendar', () => {
  const entries = calendarEntries([
    job({ id: 'j1', company: 'Acme', status: 'interviewing', nextStepDay: '2026-11-19', nextStepNote: null, events: [applied('2026-11-04'), { kind: 'followUp', day: '2026-11-08' }] }),
    job({ id: 'j2', company: 'Initech', status: 'rejected', nextStepDay: '2026-11-20', events: [applied('2026-11-01')] }),
  ]);
  expect(entries).toEqual([
    { jobId: 'j1', day: '2026-11-19', kind: 'interview', label: 'Acme · Interview' },
    { jobId: 'j1', day: '2026-11-04', kind: 'status', status: 'applied', label: 'Acme · Applied' },
    { jobId: 'j1', day: '2026-11-08', kind: 'followUp', label: 'Acme · Followed up' },
    { jobId: 'j2', day: '2026-11-01', kind: 'status', status: 'applied', label: 'Initech · Applied' },
  ]);
});
