'use client';

import { Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { chime } from '@/shared/utils/chime';

// ponytail: one rest length for everything; make it a setting if people ask for per-exercise rests.
export const REST_MS = 90_000;
const EXTRA_MS = 30_000;

const formatLeft = (ms: number) => {
  const seconds = Math.max(Math.ceil(ms / 1000), 0);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

type RestTimerProps = { until: number; onChange: (until: number | null) => void };

// Counts down the rest after a ticked set, floating at the bottom of the screen until it ends or is skipped.
export function RestTimerComponent({ until, onChange }: RestTimerProps) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) {
        chime();
        onChange(null);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [until, onChange]);

  return (
    <div role="timer" aria-label="Rest" className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-2 rounded-full border bg-popover py-1.5 pr-1.5 pl-4 shadow-lg">
      <Timer className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-sm font-medium">Rest</span>
      <span className="min-w-10 text-sm font-semibold tabular-nums">{formatLeft(until - now)}</span>
      <Button variant="ghost" size="sm" onClick={() => onChange(until + EXTRA_MS)}>
        +30 s
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange(null)}>
        Skip
      </Button>
    </div>
  );
}
