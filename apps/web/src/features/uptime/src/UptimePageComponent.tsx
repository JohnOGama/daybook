'use client';

import { Activity, Plus } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from 'skullet/react';
import { PresenceAvatarsComponent, useActiveSpace, useSpaceAccess, ViewOnlyBadgeComponent } from '@/features/spaces';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { Button } from '@/shared/components/ui/button';
import { useNow } from '@/shared/hooks/useNow';
import { useUptime } from '../hooks/useUptime';
import { MonitorDialogComponent } from './MonitorDialogComponent';
import { MonitorDrawerComponent } from './MonitorDrawerComponent';
import { MonitorTableComponent } from './MonitorTableComponent';
import { SAMPLE_UPTIME } from './sample-uptime';
import { checkedAgo, formatUptime, upNow } from './uptime-math';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function UptimePageComponent() {
  const space = useActiveSpace();
  const { canEdit } = useSpaceAccess();
  const now = useNow();
  const { data, isPending, isError } = useUptime();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load these sites. Please try again.
      </p>
    );
  }

  const view = data ?? SAMPLE_UPTIME;
  const { up, total } = upNow(view.monitors);
  const addButton = canEdit && (
    <Button size="sm" onClick={() => setAdding(true)}>
      <Plus aria-hidden />
      Add site
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{space?.title ?? 'Uptime'}</h1>
        <ViewOnlyBadgeComponent />
        <Skeleton loading={isPending}>
          <p className="text-[13px] text-muted-foreground">Checked every minute · Last check {checkedAgo(view.lastCheckedAt, now)}</p>
        </Skeleton>
        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatarsComponent />
          {addButton}
        </div>
      </header>

      {!isPending && view.monitors.length === 0 ? (
        <EmptyStateComponent
          icon={<Activity className="size-10 text-muted-foreground" aria-hidden />}
          title="No sites yet"
          description={canEdit ? 'Add a web app or an API health route. Daybook checks it every minute and shows red when it stops answering.' : 'Nothing is being watched here yet.'}
          action={addButton || undefined}
        />
      ) : (
        <Skeleton loading={isPending} label="Loading sites">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Tile label="Up now" value={`${up} of ${total}`} />
            <Tile label="Uptime, last 24 h" value={formatUptime(view.uptime24h)} />
            <Tile label="Incidents, last 7 days" value={String(view.incidents7d)} />
          </div>
          <div className="mt-5">
            <MonitorTableComponent monitors={view.monitors} now={now} onOpen={setOpenId} />
          </div>
        </Skeleton>
      )}

      {canEdit && <MonitorDialogComponent open={adding} onOpenChange={setAdding} />}
      <MonitorDrawerComponent monitorId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
