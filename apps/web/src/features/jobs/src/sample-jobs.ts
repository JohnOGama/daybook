import { addDays } from '@/shared/utils/date-formatter';
import type { Job, JobEvent, Jobs, JobStatus } from './jobs-types';
import { trailTo } from './jobs-math';

// Stands in for real data while it loads, so the skeleton has the page's shape.
export function sampleJobs(today: string): Jobs {
  const job = (id: string, role: string, company: string, status: JobStatus, daysAgo: number, pct: number | null, extra: Partial<Job> = {}): Job => {
    const day = addDays(today, -daysAgo);
    const events: JobEvent[] = trailTo(status, day);
    return {
      id: `sample-${id}`,
      role,
      company,
      url: null,
      location: 'Remote',
      workMode: 'remote',
      salary: null,
      employmentType: 'Full-time',
      postedOn: null,
      description: '',
      notes: '',
      status,
      events,
      nextStepDay: null,
      nextStepNote: null,
      nextStepAt: null,
      match: pct === null ? null : { pct, summary: '', skillsHave: [], skillsMissing: [], matchedAt: `${day}T00:00:00.000Z` },
      createdAt: `${day}T00:00:00.000Z`,
      updatedAt: `${day}T00:00:00.000Z`,
      ...extra,
    };
  };
  return {
    profile: { cvText: 'Sample CV', cvUpdatedAt: null },
    aiEnabled: true,
    jobs: [
      job('1', 'Frontend Engineer', 'Acme', 'interviewing', 2, 82),
      job('2', 'React Engineer', 'Globex', 'applied', 11, 71),
      job('3', 'Full-stack Developer', 'Stark Labs', 'saved', 1, 91),
      job('4', 'UI Engineer', 'Initech', 'rejected', 17, 46),
      job('5', 'Senior React Developer', 'Hooli', 'offer', 25, 78),
    ],
  };
}
