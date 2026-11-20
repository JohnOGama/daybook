'use client';

import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Skeleton, SkeletonBox } from 'skullet/react';
import { PresenceAvatarsComponent, useActiveSpace, useSpaceAccess, ViewOnlyBadgeComponent } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { Drawer } from '@/shared/components/ui/drawer';
import { useNow } from '../hooks/useNow';
import { usePipelines, usePipelinesSpaceId } from '../hooks/usePipelines';
import { ConnectJenkinsDialogComponent } from './ConnectJenkinsDialogComponent';
import { PipelineCanvas } from './pipeline-parts';
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
    <div className="relative flex h-full min-h-0 flex-col">
      <aside aria-label="Pipelines" className="z-10 flex max-h-60 flex-col gap-3 border-b bg-card/90 p-4 backdrop-blur md:absolute md:top-4 md:left-4 md:max-h-[calc(100%-2rem)] md:w-72 md:rounded-2xl md:border">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            <ViewOnlyBadgeComponent />
          </div>
          <Skeleton loading={isPending}>
            <p className="text-[13px] text-muted-foreground">
              {view.jobs.length} {view.jobs.length === 1 ? 'pipeline' : 'pipelines'} · updated live
            </p>
          </Skeleton>
        </div>
        <Skeleton loading={isPending} label="Loading the runs">
          {view.recent.length > 0 && <RunsTableComponent runs={view.recent} now={now} onOpen={setOpenRunId} />}
        </Skeleton>
      </aside>

      <div className="relative min-h-0 flex-1 md:absolute md:inset-0">
        {isPending ? <SkeletonBox width="100%" height="100%" /> : <PipelineCanvas jobs={view.jobs} now={now} onOpen={setOpenRunId} />}
        {!isPending && view.jobs.length === 0 && (
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            No runs yet. Connect Jenkins to start.
          </p>
        )}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <PresenceAvatarsComponent />
          {canEdit && (
            <Button variant="outline" size="sm" className="bg-card shadow-lg" onClick={() => setConnecting(true)}>
              <KeyRound aria-hidden />
              Connect Jenkins
            </Button>
          )}
        </div>
      </div>

      <Drawer direction="right" open={Boolean(open)} onOpenChange={(next) => !next && setOpenRunId(null)}>
        {open && <RunDrawerComponent key={open.id} initial={open} expected={expectedFor(open.job)} now={now} />}
      </Drawer>

      {canEdit && spaceId && (
        <ConnectJenkinsDialogComponent open={connecting} onOpenChange={setConnecting} spaceId={spaceId} spaceTitle={title} isOwner={isOwner} />
      )}
    </div>
  );
}
