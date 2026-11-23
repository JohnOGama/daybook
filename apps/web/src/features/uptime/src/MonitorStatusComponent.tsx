import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { formatSeconds } from './uptime-math';
import type { UptimeStatus } from './uptime-types';

type Look = { label: string; tone: string; dot: string };

const LOOKS: Record<UptimeStatus | 'paused' | 'unchecked', Look> = {
  up: { label: 'Up', tone: 'bg-status-done/15 text-status-done', dot: 'bg-status-done' },
  slow: { label: 'Slow', tone: 'bg-signal/15 text-signal', dot: 'bg-signal' },
  down: { label: 'Down', tone: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
  paused: { label: 'Paused', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
  unchecked: { label: 'Not checked yet', tone: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
};

type MonitorStatusProps = { status: UptimeStatus | null; paused: boolean; responseMs?: number | null; error?: string | null };

// What hovering the pill says: how fast the last check answered, or why it failed.
function detailOf({ status, paused, responseMs, error }: MonitorStatusProps): string | undefined {
  if (paused) return undefined;
  if (status === 'down') return error ?? undefined;
  if ((status === 'up' || status === 'slow') && responseMs != null) return `Responded in ${formatSeconds(responseMs)}`;
  return undefined;
}

// A site's status as a pill: paused wins over its last result, which it keeps underneath.
export function MonitorStatusComponent(props: MonitorStatusProps) {
  const look = LOOKS[props.paused ? 'paused' : (props.status ?? 'unchecked')];
  const detail = detailOf(props);
  const pill = (
    <span
      tabIndex={detail ? 0 : undefined}
      className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', look.tone)}
    >
      <span className={cn('size-1.5 rounded-full', look.dot)} aria-hidden />
      {look.label}
    </span>
  );
  if (!detail) return pill;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{pill}</TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  );
}
