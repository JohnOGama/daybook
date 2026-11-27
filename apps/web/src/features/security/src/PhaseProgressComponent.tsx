import { Check, Loader2, Minus } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { ScanPhase } from './security-types';

// The passive checks this scan actually runs, shown as a methodology panel (inspired by xalgorix). These are read-only
// GET-based checks — no active-exploitation phases, so the progress reflects real work, never faked testing.
export const SCAN_PHASES: { id: string; label: string }[] = [
  { id: 'recon', label: 'Reconnaissance' },
  { id: 'transport', label: 'Transport & TLS' },
  { id: 'headers', label: 'Security headers' },
  { id: 'cors', label: 'CORS policy' },
  { id: 'cookies', label: 'Cookies & session' },
  { id: 'content', label: 'Page content' },
  { id: 'disclosure', label: 'Information disclosure' },
  { id: 'ai', label: 'AI analysis' },
  { id: 'report', label: 'Report' },
];

type PhaseProgressProps = { activeIndex: number; result: ScanPhase[] | null };

export function PhaseProgressComponent({ activeIndex, result }: PhaseProgressProps) {
  const byId = new Map(result?.map((p) => [p.id, p]));
  const done = result ? SCAN_PHASES.length : activeIndex;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        {SCAN_PHASES.map((phase, index) => {
          const settled = byId.get(phase.id);
          const state = settled ? (settled.status === 'skipped' ? 'skipped' : 'done') : index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'idle';
          return <span key={phase.id} className={cn('h-1.5 flex-1 rounded-full transition-colors', state === 'done' && 'bg-status-done', state === 'active' && 'animate-pulse bg-signal', state === 'skipped' && 'bg-muted-foreground/40', state === 'idle' && 'bg-muted')} />;
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {result ? `${done} of ${SCAN_PHASES.length} phases complete` : `Phase ${Math.min(activeIndex + 1, SCAN_PHASES.length)} of ${SCAN_PHASES.length}: ${SCAN_PHASES[Math.min(activeIndex, SCAN_PHASES.length - 1)].label}`}
      </p>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {SCAN_PHASES.map((phase, index) => {
          const settled = byId.get(phase.id);
          const state = settled ? (settled.status === 'skipped' ? 'skipped' : 'done') : index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'idle';
          return (
            <li key={phase.id} className={cn('flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-sm', state === 'active' && 'border-signal/60', state === 'idle' && 'opacity-50')}>
              <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', state === 'done' && 'bg-status-done/15 text-status-done', state === 'active' && 'text-signal', state === 'skipped' && 'text-muted-foreground', (state === 'idle' || state === 'active') && 'bg-muted')}>
                {state === 'done' ? <Check className="size-3.5" aria-hidden /> : state === 'active' ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : state === 'skipped' ? <Minus className="size-3.5" aria-hidden /> : <span className="text-[10px] text-muted-foreground">{index + 1}</span>}
              </span>
              <span className="flex-1 truncate">{phase.label}</span>
              {settled && settled.status !== 'skipped' && settled.findings > 0 && <span className="shrink-0 rounded-md bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{settled.findings}</span>}
              {settled?.status === 'skipped' && <span className="shrink-0 text-[11px] text-muted-foreground">off</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
