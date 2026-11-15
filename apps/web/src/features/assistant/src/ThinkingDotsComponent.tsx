import { cn } from '@/shared/utils/cn';

const SIZE = 11;
const GAP = 16;
const MIDDLE = (SIZE - 1) / 2;

// An 11×11 grid on 16 px steps, kept to a circle; `distance` is in grid cells from the centre.
export function dotField(): { x: number; y: number; distance: number }[] {
  const dots = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const distance = Math.hypot(row - MIDDLE, col - MIDDLE);
      if (distance <= MIDDLE + 0.2) dots.push({ x: col * GAP, y: row * GAP, distance });
    }
  }
  return dots;
}

const DOTS = dotField();

// The assistant's state as a field of white dots. Idle: every dot breathes together, slowly. Thinking: each dot waits
// by its distance from the centre, so a quick ripple runs outwards. The keyframes live in globals.css.
export function ThinkingDotsComponent({ thinking }: { thinking: boolean }) {
  return (
    <div role="img" aria-label={thinking ? 'Thinking…' : 'Ready when you are'} className="relative size-[166px]">
      {DOTS.map(({ x, y, distance }) => (
        <span
          key={`${x}-${y}`}
          className={cn('absolute size-1.5 rounded-full bg-foreground', thinking ? 'assistant-dot-thinking' : 'assistant-dot-idle')}
          style={{ left: x, top: y, animationDelay: thinking ? `${(distance * 0.11).toFixed(2)}s` : undefined }}
        />
      ))}
    </div>
  );
}
