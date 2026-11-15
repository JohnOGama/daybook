'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from 'skullet/react';
import { PresenceAvatarsComponent, useActiveSpace, useSpaceAccess, ViewOnlyBadgeComponent } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { Drawer } from '@/shared/components/ui/drawer';
import { useNow } from '../hooks/useNow';
import { usePipelines, usePipelinesSpaceId } from '../hooks/usePipelines';
import { ConnectJenkinsDialogComponent } from './ConnectJenkinsDialogComponent';
import { JobCardComponent } from './JobCardComponent';
import { RunDrawerComponent } from './RunDrawerComponent';
import { RunsTableComponent } from './RunsTableComponent';
import { samplePipelines } from './sample-pipelines';

export function PipelinesPageComponent() {
  const space = useActiveSpace();
  const spaceId = usePipelinesSpaceId();
  const { canEdit, isOwner } = useSpaceAccess();
  const now = useNow();
  const { data, isPending, isError } = usePipelines();
  const [sample] = useState(() => samplePipelines(new Date()));
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load these pipelines. Please try again.
      </p>
    );
  }

  const view = data ?? sample;
  const open = isPending ? undefined : [...view.jobs.map((job) => job.latest), ...view.recent].find((run) => run.id === openRunId);
  const expectedFor = (job: string) => view.jobs.find((entry) => entry.job === job)?.expected ?? [];
  const title = space?.title ?? 'Pipelines';

  return (
    <div className="pb-16">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-5 md:px-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            <ViewOnlyBadgeComponent />
          </div>
          <Skeleton loading={isPending}>
            <p className="text-[13px] text-muted-foreground">
              {view.jobs.length} {view.jobs.length === 1 ? 'pipeline' : 'pipelines'} reporting from Jenkins · updated live
            </p>
          </Skeleton>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatarsComponent />
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setConnecting(true)}>
              <KeyRound aria-hidden />
              Connect Jenkins
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto mt-5 flex max-w-6xl flex-col gap-4 px-4 md:px-6">
        <Skeleton loading={isPending} label="Loading the pipelines">
          <div className="flex flex-col gap-4">
            {view.jobs.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">No runs yet. Connect Jenkins to start.</p>
            ) : (
              view.jobs.map((job) => <JobCardComponent key={job.job} job={job} now={now} onOpen={setOpenRunId} />)
            )}
            {view.recent.length > 0 && <RunsTableComponent runs={view.recent} now={now} onOpen={setOpenRunId} />}
          </div>
        </Skeleton>
      </div>

      <Drawer direction="right" open={Boolean(open)} onOpenChange={(next) => !next && setOpenRunId(null)} modal={false}>
        {open && <RunDrawerComponent key={open.id} initial={open} expected={expectedFor(open.job)} now={now} />}
      </Drawer>

      {canEdit && spaceId && (
        <ConnectJenkinsDialogComponent open={connecting} onOpenChange={setConnecting} spaceId={spaceId} spaceTitle={title} isOwner={isOwner} />
      )}
    </div>
  );
}
