'use client';

import { Pause, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SkeletonBox } from 'skullet/react';
import { useSpaceAccess } from '@/features/spaces';
import { DrawerCloseButtonComponent } from '@/shared/components/DrawerCloseButtonComponent';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/shared/components/ui/drawer';
import { useNow } from '@/shared/hooks/useNow';
import { cn } from '@/shared/utils/cn';
import { useUptimeMonitor } from '../hooks/useUptimeMonitor';
import { useUptimeMutations } from '../hooks/useUptimeMutations';
import { MonitorDialogComponent } from './MonitorDialogComponent';
import { MonitorStatusComponent } from './MonitorStatusComponent';
import { ResponseChartComponent } from './ResponseChartComponent';
import { formatDuration, formatUptime } from './uptime-math';
import type { Incident, MonitorDetail } from './uptime-types';

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

function IncidentItem({ incident, now }: { incident: Incident; now: Date }) {
  const started = new Date(incident.startedAt).getTime();
  const ongoing = incident.endedAt === null;
  return (
    <li className="rounded-lg border bg-card px-3 py-2 text-[13px]">
      {ongoing ? (
        <p>
          <b className="text-destructive">Down now</b> · since {clock(incident.startedAt)} ({formatDuration(now.getTime() - started)})
        </p>
      ) : (
        <p>
          <b>Down {formatDuration(new Date(incident.endedAt as string).getTime() - started)}</b> · {day(incident.startedAt)} {clock(incident.startedAt)}–{clock(incident.endedAt as string)}
        </p>
      )}
      {incident.reason && <p className="text-xs text-muted-foreground">{incident.reason}</p>}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Details({ site, onClose }: { site: MonitorDetail; onClose: () => void }) {
  const { canEdit } = useSpaceAccess();
  const now = useNow();
  const { check, update, remove } = useUptimeMutations();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <DrawerTitle className="truncate text-lg tracking-tight">{site.name}</DrawerTitle>
            <span className="rounded-md border px-1.5 text-[11px] text-muted-foreground">{site.kind === 'api' ? 'API' : 'Web'}</span>
            <MonitorStatusComponent status={site.status} paused={site.paused} />
          </div>
          <DrawerDescription className="truncate font-mono text-xs">{site.url}</DrawerDescription>
        </div>
        <DrawerCloseButtonComponent />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ['24 h', site.uptime24h],
          ['7 days', site.uptime7d],
          ['30 days', site.uptime30d],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-semibold tabular-nums">{formatUptime(value as number | null)}</p>
          </div>
        ))}
      </div>

      <Section title="Response time, last 24 h">
        <ResponseChartComponent values={site.responseBars} />
      </Section>

      <Section title="Incidents">
        {site.incidents.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No incidents in the last 30 days.</p>
        ) : (
          <ul aria-label="Incidents" className="flex flex-col gap-1.5">
            {site.incidents.map((incident) => (
              <IncidentItem key={incident.id} incident={incident} now={now} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Check">
        <p className="text-[13px] text-muted-foreground">Every minute · up when it answers 2xx or 3xx within 10 s · slow above 2 s</p>
      </Section>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={check.isPending} onClick={() => check.mutate(site.id)}>
            <RefreshCw className={cn(check.isPending && 'motion-safe:animate-spin')} aria-hidden />
            Check now
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          <Button variant="outline" size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: site.id, changes: { paused: !site.paused } })}>
            {site.paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {site.paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden />
            Delete
          </Button>
        </div>
      )}

      {canEdit && <MonitorDialogComponent open={editing} onOpenChange={setEditing} monitor={site} />}
      {canEdit && (
        <AlertDialog open={deleting} onOpenChange={setDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {site.name}?</AlertDialogTitle>
              <AlertDialogDescription>Its history and incidents go too. This can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  remove.mutate(site.id);
                  onClose();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

function Loading() {
  return (
    <div role="status" aria-label="Loading site" className="flex flex-col gap-3">
      <DrawerTitle className="sr-only">Loading site</DrawerTitle>
      <SkeletonBox width="60%" height={24} />
      <SkeletonBox width="100%" height={56} />
      <SkeletonBox width="100%" height={80} />
      <SkeletonBox width="100%" height={120} />
    </div>
  );
}

// One site in full, on the right: uptime over three spans, response times, incidents and the site's actions.
export function MonitorDrawerComponent({ monitorId, onClose }: { monitorId: string | null; onClose: () => void }) {
  const { data, isError } = useUptimeMonitor(monitorId ?? undefined);

  return (
    <Drawer direction="right" open={Boolean(monitorId)} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="gap-5 overflow-y-auto overscroll-contain p-4 data-[vaul-drawer-direction=right]:sm:max-w-md">
        {isError ? (
          <>
            <DrawerTitle className="sr-only">Site</DrawerTitle>
            <p role="alert" className="text-sm text-destructive">
              Could not load this site. Please try again.
            </p>
          </>
        ) : data && data.id === monitorId ? (
          <Details site={data} onClose={onClose} />
        ) : (
          <Loading />
        )}
      </DrawerContent>
    </Drawer>
  );
}
