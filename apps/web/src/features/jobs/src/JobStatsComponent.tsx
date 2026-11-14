import { StatTileComponent } from '@/features/budget';
import { formatShortDay } from '@/shared/utils/date-formatter';
import { jobStats } from './jobs-math';
import type { Job } from './jobs-types';

const percent = (share: number) => `${Math.round(share * 100)}%`;

export function JobStatsComponent({ jobs, today }: { jobs: Job[]; today: string }) {
  const stats = jobStats(jobs, today);
  const share = (count: number) => (stats.everApplied === 0 ? 0 : (count / stats.everApplied) * 100);
  return (
    <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTileComponent label="Applied this week" value={String(stats.appliedWeek)} detail={`${stats.appliedMonth} in the last 30 days`} />
      <StatTileComponent
        label="Waiting on a reply"
        value={String(stats.waiting)}
        detail={stats.waitingLong > 0 ? `${stats.waitingLong} for over 2 weeks` : 'None waiting long'}
      />
      <StatTileComponent
        label="Interviewing"
        value={String(stats.interviewing)}
        detail={stats.nextStep ? `Next: ${stats.nextStep.job.company}, ${formatShortDay(stats.nextStep.day)}` : 'Nothing booked'}
      />
      <StatTileComponent label="Reply rate" value={stats.replyRate === null ? '—' : percent(stats.replyRate)} detail={stats.replyRate === null ? 'Apply to a job to see this' : undefined}>
        {stats.replyRate !== null && (
          <div aria-hidden className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="h-full bg-status-hold" style={{ width: `${share(stats.replied.interviewing)}%` }} />
            <span className="h-full bg-status-done" style={{ width: `${share(stats.replied.offer)}%` }} />
            <span className="h-full bg-muted-foreground" style={{ width: `${share(stats.replied.rejected)}%` }} />
          </div>
        )}
      </StatTileComponent>
    </section>
  );
}
