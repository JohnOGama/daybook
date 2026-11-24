'use client';

import { Pause, Play, Timer, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { formatClock, isActive, isRunning, leftAt } from './focus-math';
import { PHASE_LABELS } from './focus-types';

// Where the pill sits, as its distance from the window's right and bottom edges, so it stays put when the window grows.
type Position = { right: number; bottom: number };

const POSITION_KEY = 'daybook-focus-pill-position';
// Above the Assistant button by default.
const DEFAULT_POSITION: Position = { right: 20, bottom: 80 };
const EDGE = 8;
const KEY_STEP = 16;
// A press only becomes a drag after this many pixels, so clicks on the clock and buttons still work.
const DRAG_AFTER = 4;
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] };

function readPosition(): Position {
  try {
    const stored = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null');
    return typeof stored?.right === 'number' && typeof stored?.bottom === 'number' ? stored : DEFAULT_POSITION;
  } catch {
    return DEFAULT_POSITION;
  }
}

function savePosition(position: Position) {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    // Without storage the pill just starts from the default spot next time.
  }
}

// Keeps the whole pill inside the window.
function clamp(position: Position, pill: HTMLElement | null): Position {
  const width = pill?.offsetWidth ?? 0;
  const height = pill?.offsetHeight ?? 0;
  const keep = (value: number, room: number) => Math.min(Math.max(value, EDGE), Math.max(room - EDGE, EDGE));
  return { right: keep(position.right, window.innerWidth - width), bottom: keep(position.bottom, window.innerHeight - height) };
}

// Once a Focus space has been opened, its timer floats on every other page: start, pause or resume it from anywhere,
// drag it anywhere it's out of the way (or focus it and use the arrow keys), and click the clock to go back. An idle timer can be hidden.
export function FocusPillComponent() {
  const { timer, now, start, pause, clear } = useFocusTimer();
  const pathname = usePathname();
  const pill = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; from: Position; to: Position; moved: boolean } | null>(null);
  // Set when a drag ends, so the click the browser sends on release doesn't follow the link or press a button.
  const justDragged = useRef(false);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const shown = Boolean(timer) && pathname !== '/focus';

  useEffect(() => {
    if (!shown) return;
    const fit = () => setPosition((current) => clamp(current, pill.current));
    setPosition(clamp(readPosition(), pill.current));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [shown]);

  if (!timer || !shown) return null;
  const running = isRunning(timer);
  const active = isActive(timer);
  const label = running ? PHASE_LABELS[timer.phase] : active ? 'Paused' : `${PHASE_LABELS[timer.phase]} · ready`;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, from: position, to: position, moved: false };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const { x, y, from } = drag.current;
    if (!drag.current.moved) {
      if (Math.hypot(event.clientX - x, event.clientY - y) < DRAG_AFTER) return;
      drag.current.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    drag.current.to = clamp({ right: from.right - (event.clientX - x), bottom: from.bottom - (event.clientY - y) }, pill.current);
    setPosition(drag.current.to);
  }

  function onPointerUp() {
    if (drag.current?.moved) {
      savePosition(drag.current.to);
      justDragged.current = true;
    }
    drag.current = null;
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!justDragged.current) return;
    justDragged.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // Arrow keys move the pill while the pill itself (not one of its buttons) has focus.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = ARROWS[event.key];
    if (!step || event.target !== event.currentTarget) return;
    event.preventDefault();
    const next = clamp({ right: position.right + step[0], bottom: position.bottom + step[1] }, pill.current);
    setPosition(next);
    savePosition(next);
  }

  return (
    <div
      ref={pill}
      role="status"
      aria-label="Focus timer"
      tabIndex={0}
      title="Drag to move"
      style={{ right: position.right, bottom: position.bottom }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      className="fixed z-40 flex max-w-[calc(100vw-1rem)] cursor-grab touch-none items-center gap-0.5 rounded-full border bg-popover py-1 pr-1 pl-1 shadow-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <Link
        href={`/focus?space=${timer.spaceId}`}
        className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-2 pl-2.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Timer className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-semibold tabular-nums">{formatClock(leftAt(timer, now))}</span>
        <span className="truncate text-muted-foreground">{label}</span>
      </Link>
      <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" aria-label={running ? 'Pause focus timer' : active ? 'Resume focus timer' : 'Start focus timer'} onClick={running ? pause : start}>
        {running ? <Pause aria-hidden /> : <Play aria-hidden />}
      </Button>
      {!active && (
        <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full text-muted-foreground" aria-label="Hide focus timer" onClick={clear}>
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}
