'use client';

import { FileText, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { useActiveSpace } from '@/features/spaces';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Drawer } from '@/shared/components/ui/drawer';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useToday } from '@/shared/hooks/useToday';
import { useJobs } from '../hooks/useJobs';
import { AddFromLinkComponent } from './AddFromLinkComponent';
import { CvDialogComponent } from './CvDialogComponent';
import { countByStatus, visibleJobs } from './jobs-math';
import { JOB_STATUSES, type JobSort, type JobStatus, STATUS_LABELS } from './jobs-types';
import { JobFormDialogComponent, type JobFormInitial } from './JobFormDialogComponent';
import { JobPanelComponent } from './JobPanelComponent';
import { JobStatsComponent } from './JobStatsComponent';
import { JobsTableComponent } from './JobsTableComponent';
import { sampleJobs } from './sample-jobs';

const TABS: (JobStatus | 'all')[] = ['all', ...JOB_STATUSES];

export function JobsPageComponent() {
  const space = useActiveSpace();
  const today = useToday();
  const { data, isPending, isError } = useJobs();
  const sample = useMemo(() => sampleJobs(today), [today]);
  const [tab, setTab] = useState<JobStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<JobSort>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [form, setForm] = useState<JobFormInitial | null>(null);
  const [cvOpen, setCvOpen] = useState(false);

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this job hunt. Please try again.
      </p>
    );
  }

  const { profile, jobs, aiEnabled } = data ?? sample;
  const counts = countByStatus(jobs);
  const shown = visibleJobs(jobs, { status: tab, query, sort });
  const selected = isPending ? undefined : jobs.find((job) => job.id === selectedId);
  const empty = jobs.length > 0 ? 'No jobs match.' : aiEnabled ? 'No jobs yet. Paste a link above or add one by hand.' : 'No jobs yet. Add one by hand.';

  return (
    <div className="pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-5 md:px-6">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{space?.title ?? 'Job hunt'}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => setCvOpen(true)}>
            <FileText aria-hidden />
            {profile.cvText ? 'Your CV' : 'Add your CV'}
          </Button>
          <Button size="sm" disabled={isPending} onClick={() => setForm({})}>
            <Plus aria-hidden />
            Add manually
          </Button>
        </div>
      </header>

      <div className="mx-auto mt-4 flex max-w-6xl flex-col gap-4 px-4 md:px-6">
        <Skeleton loading={isPending} label="Loading your job hunt">
          <div className="flex min-w-0 flex-col gap-4">
            {aiEnabled && (
              <AddFromLinkComponent
                jobs={jobs}
                hasCv={Boolean(profile.cvText)}
                onPending={setPendingUrl}
                onDuplicate={(job) => setSelectedId(job.id)}
                onFallback={setForm}
              />
            )}
            <JobStatsComponent jobs={jobs} today={today} />

            <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
              <Tabs value={tab} onValueChange={(value) => setTab(value as JobStatus | 'all')} className="min-w-0">
                <TabsList variant="line" aria-label="Filter by status" className="w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {TABS.map((status) => (
                    <TabsTrigger key={status} value={status} className="flex-none px-3">
                      {status === 'all' ? 'All' : STATUS_LABELS[status]}{' '}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[11px] tabular-nums">
                        {counts[status]}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative xl:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input type="search" aria-label="Search jobs" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-8" />
              </div>
            </div>

            <JobsTableComponent
              jobs={shown}
              empty={empty}
              profile={profile}
              aiEnabled={aiEnabled}
              today={today}
              pendingUrl={pendingUrl}
              sort={sort}
              onSort={setSort}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onAddCv={() => setCvOpen(true)}
            />
          </div>
        </Skeleton>
      </div>

      <Drawer direction="right" open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)} modal={false}>
        {selected && (
          <JobPanelComponent
            key={selected.id}
            job={selected}
            profile={profile}
            aiEnabled={aiEnabled}
            today={today}
            onClose={() => setSelectedId(null)}
            onAddCv={() => setCvOpen(true)}
          />
        )}
      </Drawer>

      <JobFormDialogComponent initial={form} today={today} onClose={() => setForm(null)} />
      <CvDialogComponent open={cvOpen} cvText={profile.cvText} onClose={() => setCvOpen(false)} />
    </div>
  );
}
