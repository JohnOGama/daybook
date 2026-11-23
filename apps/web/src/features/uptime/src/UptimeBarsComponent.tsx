'use client';

import { CircleCheck, CircleMinus, OctagonAlert, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import type { Bar } from './uptime-types';

const LOOK: Record<Bar, { tone: string; word: string; Icon: typeof CircleCheck; ink: string }> = {
  up: { tone: 'bg-status-done', word: 'Up', Icon: CircleCheck, ink: 'text-status-done' },
  slow: { tone: 'bg-signal', word: 'Slow', Icon: TriangleAlert, ink: 'text-signal' },
  down: { tone: 'bg-destructive', word: 'Down', Icon: OctagonAlert, ink: 'text-destructive' },
  none: { tone: 'bg-muted', word: 'No checks', Icon: CircleMinus, ink: 'text-muted-foreground' },
};
const HALF_HOUR = 30 * 60_000;

const clock = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day = (date: Date) => date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

// One half hour on hover: when it was, and its worst result.
function BarDetail({ bar, start }: { bar: Bar; start: Date }) {
  const { word, Icon, ink } = LOOK[bar];
  return (
    <div className="flex w-52 flex-col gap-2 py-1">
      <p className="text-[13px] font-semibold">{day(start)}</p>
      <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-[13px]">
        <Icon className={cn('size-4 shrink-0', ink)} aria-hidden />
        <span className="font-medium">{word}</span>
        <span className="ml-auto text-muted-foreground tabular-nums">
          {clock(start)}–{clock(new Date(start.getTime() + HALF_HOUR))}
        </span>
      </div>
    </div>
  );
}

// The last 24 hours as 48 half-hour bars, oldest first. Hovering a bar shows a card with its time and result; only the
// hovered bar carries a tooltip, so a long table of sites doesn't hold thousands of them.
export function UptimeBarsComponent({ bars, now = new Date() }: { bars: Bar[]; now?: Date }) {
  const [hovered, setHovered] = useState<number>();
  const startOf = (index: number) => new Date(now.getTime() - (bars.length - index) * HALF_HOUR);

  return (
    <div aria-label="Last 24 hours" role="img" className="flex h-6 items-stretch gap-px" onPointerLeave={() => setHovered(undefined)}>
      {bars.map((bar, index) => {
        const strip = (
          <span
            key={index}
            onPointerEnter={() => setHovered(index)}
            className={cn('min-w-0.5 flex-1 rounded-[2px] transition-opacity', LOOK[bar].tone, hovered !== undefined && hovered !== index && 'opacity-60')}
          />
        );
        if (index !== hovered) return strip;
        return (
          <Tooltip key={index} open>
            <TooltipTrigger asChild>{strip}</TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <BarDetail bar={bar} start={startOf(index)} />
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
