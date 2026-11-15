import { Check, Circle, CircleMinus, Loader2, X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { type ShownStatus, STATUS_LABELS, type StageStatus } from './pipelines-types';

const PILL: Record<ShownStatus, string> = {
  running: 'bg-status-progress/15 text-status-progress',
  passed: 'bg-status-done/15 text-status-done',
  failed: 'bg-destructive/15 text-destructive',
  stopped: 'bg-destructive/15 text-destructive',
};

// The run's status as a small pill: green passed, blue (pulsing) running, red failed or stopped reporting.
export function RunStatusComponent({ status }: { status: ShownStatus }) {
  return (
    <span className={cn('inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', PILL[status])}>
      {status === 'running' ? (
        <span className="size-1.5 rounded-full bg-status-progress motion-safe:animate-pulse" aria-hidden />
      ) : status === 'passed' ? (
        <Check className="size-3" strokeWidth={3} aria-hidden />
      ) : (
        <X className="size-3" strokeWidth={3} aria-hidden />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

// One stage's icon: ✓ passed, ✗ failed, a spinner while running, a dash when skipped, a ring when still to come.
export function StageIconComponent({ status }: { status: StageStatus | 'pending' }) {
  if (status === 'passed') return <Check className="size-3.5 shrink-0 text-status-done" strokeWidth={2.5} aria-hidden />;
  if (status === 'failed') return <X className="size-3.5 shrink-0 text-destructive" strokeWidth={2.5} aria-hidden />;
  if (status === 'running') return <Loader2 className="size-3.5 shrink-0 text-status-progress motion-safe:animate-spin" strokeWidth={2.5} aria-hidden />;
  if (status === 'skipped') return <CircleMinus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  return <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}
