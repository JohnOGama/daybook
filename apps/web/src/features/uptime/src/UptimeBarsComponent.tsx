import { cn } from '@/shared/utils/cn';
import type { Bar } from './uptime-types';

const TONE: Record<Bar, string> = { up: 'bg-status-done', slow: 'bg-signal', down: 'bg-destructive', none: 'bg-muted' };
const WORD: Record<Bar, string> = { up: 'up', slow: 'slow', down: 'down', none: 'no checks' };
const HALF_HOUR = 30 * 60_000;

const clock = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// The last 24 hours as 48 half-hour bars, oldest first; each is titled with its status and the time it starts.
export function UptimeBarsComponent({ bars, now = new Date() }: { bars: Bar[]; now?: Date }) {
  return (
    <div aria-label="Last 24 hours" role="img" className="flex h-6 items-stretch gap-px">
      {bars.map((bar, index) => (
        <span
          key={index}
          title={`${WORD[bar]} · ${clock(new Date(now.getTime() - (bars.length - index) * HALF_HOUR))}`}
          className={cn('min-w-0.5 flex-1 rounded-[2px]', TONE[bar])}
        />
      ))}
    </div>
  );
}
