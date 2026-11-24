'use client';

import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import type { FocusTimer } from '../hooks/useFocusTimer';
import { formatClock, isActive, isRunning, leftAt, phaseMs } from './focus-math';
import { PHASE_LABELS, type Phase, type TimerState } from './focus-types';

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const PHASES: Phase[] = ['focus', 'short', 'long'];

type FocusClockProps = { timer: TimerState; now: number; controls: Omit<FocusTimer, 'timer' | 'now' | 'prepare' | 'setTask' | 'clear'> };

// The big clock: phase, time left as a ring, Start/Pause, Reset and Skip, and how far to the long break.
export function FocusClockComponent({ timer, now, controls }: FocusClockProps) {
  const left = leftAt(timer, now);
  const total = phaseMs(timer.phase, timer.settings);
  const done = total > 0 ? 1 - left / total : 0;
  const running = isRunning(timer);
  const active = isActive(timer);
  const every = timer.settings.longBreakEvery;
  const inCycle = timer.completed % every;

  return (
    <section aria-label="Timer" className="flex flex-col items-center gap-5 rounded-xl border bg-card px-4 py-6 sm:px-6">
      <div role="group" aria-label="Phase" className="flex gap-1 rounded-full bg-muted p-1">
        {PHASES.map((phase) => (
          <button
            key={phase}
            type="button"
            aria-pressed={timer.phase === phase}
            disabled={active && timer.phase !== phase}
            onClick={() => controls.choosePhase(phase)}
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              timer.phase === phase && 'bg-background text-foreground shadow-sm',
            )}
          >
            {PHASE_LABELS[phase]}
          </button>
        ))}
      </div>

      <div className="relative size-56 sm:size-64">
        <svg viewBox="0 0 200 200" aria-hidden className="size-full -rotate-90">
          <circle cx={100} cy={100} r={RADIUS} fill="none" strokeWidth={8} className="stroke-muted" />
          {done > 0 && (
            <circle
              cx={100}
              cy={100}
              r={RADIUS}
              fill="none"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${done * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              className={cn('transition-[stroke-dasharray] duration-500', timer.phase === 'focus' ? 'stroke-foreground' : 'stroke-muted-foreground')}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span role="timer" aria-label={`${PHASE_LABELS[timer.phase]} time left`} className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
            {formatClock(left)}
          </span>
          <span className="text-sm text-muted-foreground">{running ? PHASE_LABELS[timer.phase] : active ? 'Paused' : `Ready to ${timer.phase === 'focus' ? 'focus' : 'rest'}`}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Reset" disabled={!active} onClick={controls.reset}>
          <RotateCcw aria-hidden />
        </Button>
        {running ? (
          <Button size="lg" className="min-w-36" onClick={controls.pause}>
            <Pause aria-hidden />
            Pause
          </Button>
        ) : (
          <Button size="lg" className="min-w-36" onClick={controls.start}>
            <Play aria-hidden />
            {active ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={timer.phase === 'focus' ? 'Skip to break' : 'Skip break'} onClick={controls.skip}>
          <SkipForward aria-hidden />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <div aria-hidden className="flex gap-1.5">
          {Array.from({ length: every }, (_, index) => (
            <span key={index} className={cn('size-2 rounded-full', index < inCycle ? 'bg-foreground' : 'bg-muted')} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {inCycle} of {every} until a long break
        </p>
      </div>

    </section>
  );
}
