export const JOB_STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// The steps shown in order in the panel; "Not accepted" sits apart from them.
export const STATUS_STEPS = ['saved', 'applied', 'interviewing', 'offer'] as const;

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Not accepted',
};

export const STATUS_DOT: Record<JobStatus, string> = {
  saved: 'bg-status-todo',
  applied: 'bg-status-progress',
  interviewing: 'bg-status-hold',
  offer: 'bg-status-done',
  rejected: 'bg-muted-foreground',
};

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export const WORK_MODE_LABELS: Record<WorkMode, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

export type JobEvent = { kind: 'status'; status: JobStatus; day: string } | { kind: 'followUp'; day: string };

export type Match = { pct: number; summary: string; skillsHave: string[]; skillsMissing: string[]; matchedAt: string };

export type JobFields = {
  role: string;
  company: string;
  url: string | null;
  location: string | null;
  workMode: WorkMode | null;
  salary: string | null;
  employmentType: string | null;
  postedOn: string | null;
  description: string;
  notes: string;
  status: JobStatus;
  events: JobEvent[];
  nextStepDay: string | null;
  nextStepNote: string | null;
  // The interview's exact moment, when a time was given: the server emails a reminder 30 minutes before.
  nextStepAt: string | null;
};

export type Job = JobFields & { id: string; match: Match | null; createdAt: string; updatedAt: string };
export type JobProfile = { cvText: string | null; cvUpdatedAt: string | null };
export type Jobs = { profile: JobProfile; jobs: Job[]; aiEnabled: boolean };

export type Posting = Pick<JobFields, 'role' | 'company' | 'location' | 'workMode' | 'salary' | 'employmentType' | 'postedOn' | 'description'>;
export type ReadFailure = 'login' | 'unreadable' | 'notPosting';
export type ReadPostingResult = { ok: true; posting: Posting } | { ok: false; reason: ReadFailure };

export type JobSort = 'recent' | 'applied' | 'match';
