'use client';

import { Plus, Radar, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from 'skullet/react';
import { PresenceAvatarsComponent, useActiveSpace, useSpaceAccess, ViewOnlyBadgeComponent } from '@/features/spaces';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useSecurity } from '../hooks/useSecurity';
import { useSecurityMutations } from '../hooks/useSecurityMutations';
import { FindingDialogComponent } from './FindingDialogComponent';
import { FindingTableComponent } from './FindingTableComponent';
import { SAMPLE_SECURITY } from './sample-security';
import { ScanDialogComponent } from './ScanDialogComponent';
import { riskOverview, SEVERITIES, SEVERITY_META } from './security-math';
import type { FindingRow } from './security-types';

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', tone)}>{value}</p>
    </div>
  );
}

export function SecurityPageComponent() {
  const space = useActiveSpace();
  const { canEdit } = useSpaceAccess();
  const { data, isPending, isError } = useSecurity();
  const { remove } = useSecurityMutations();
  const [editing, setEditing] = useState<FindingRow | 'new' | null>(null);
  const [scanning, setScanning] = useState(false);

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load these findings. Please try again.
      </p>
    );
  }

  const view = data ?? SAMPLE_SECURITY;
  const risk = riskOverview(view.findings);
  const worstTone = risk.worst ? SEVERITY_META[risk.worst].badge.split(' ').find((c) => c.startsWith('text-')) : undefined;
  const actions = canEdit && (
    <>
      <Button size="sm" variant="outline" onClick={() => setScanning(true)}>
        <Radar aria-hidden />
        Scan a URL
      </Button>
      <Button size="sm" onClick={() => setEditing('new')}>
        <Plus aria-hidden />
        Add finding
      </Button>
    </>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{space?.title ?? 'Security'}</h1>
        <ViewOnlyBadgeComponent />
        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatarsComponent />
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </header>

      {!isPending && view.findings.length === 0 ? (
        <EmptyStateComponent
          icon={<ShieldAlert className="size-10 text-muted-foreground" aria-hidden />}
          title="No findings yet"
          description={canEdit ? 'Log a vulnerability or issue with its severity, CVSS score and status. The risk overview updates as you go.' : 'Nothing has been logged here yet.'}
          action={actions || undefined}
        />
      ) : (
        <Skeleton loading={isPending} label="Loading findings">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Tile label="Open" value={String(risk.open)} tone={risk.open > 0 ? worstTone : undefined} />
            {SEVERITIES.slice(0, 3).map((severity) => (
              <Tile key={severity} label={SEVERITY_META[severity].label} value={String(risk.bySeverity[severity])} />
            ))}
          </div>
          <div className="mt-5">
            <FindingTableComponent findings={view.findings} canEdit={canEdit} onEdit={setEditing} onDelete={(id) => remove.mutate(id)} />
          </div>
        </Skeleton>
      )}

      {canEdit && <FindingDialogComponent open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} finding={editing && editing !== 'new' ? editing : undefined} />}
      {canEdit && <ScanDialogComponent open={scanning} onOpenChange={setScanning} />}
    </div>
  );
}
