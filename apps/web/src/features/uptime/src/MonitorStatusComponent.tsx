import { cn } from '@/shared/utils/cn';
import type { UptimeStatus } from './uptime-types';

type Look = { label: string; tone: string; dot: string };

const LOOKS: Record<UptimeStatus | 'paused' | 'unchecked', Look> = {
  up: { label: 'Up', tone: 'bg-status-done/15 text-status-done', dot: 'bg-status-done' },
  slow: { label: 'Slow', tone: 'bg-signal/15 text-signal', dot: 'bg-signal' },
  down: { label: 'Down', tone: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
  paused: { label: 'Paused', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  unchecked: { label: 'Not checked yet', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

// A site's status as a pill: paused wins over its last result, which it keeps underneath.
export function MonitorStatusComponent({ status, paused }: { status: UptimeStatus | null; paused: boolean }) {
  const look = LOOKS[paused ? 'paused' : (status ?? 'unchecked')];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', look.tone)}>
      <span className={cn('size-1.5 rounded-full', look.dot)} aria-hidden />
      {look.label}
    </span>
  );
}
