'use client';

import { type CSSProperties, type PointerEvent, useEffect, useRef } from 'react';
import { cn } from '@/shared/utils/cn';

const SIZE = 11;
const GAP = 16;
const MIDDLE = (SIZE - 1) / 2;
const DOT = 6;
// One idle twinkle, in seconds; it must match the keyframe duration in globals.css.
const TWINKLE_S = 5;
// How long the dots take to glide between idle and thinking, in ms.
const RAMP_MS = 700;
// How far the pointer reaches, and how far it can push a dot, in px.
const REACH = 46;
const MAX_PUSH = 12;

// `dx`/`dy`: the unit direction out from the centre (the thinking breath moves each dot out along it and back).
// `breath`: when that dot breathes, in seconds; dots farther out follow a moment later, so the breath swells from the
// centre. `twinkle`: a fixed scattered offset for the idle float. `fx`/`fy`: where the dot floats to while idle.
export type Dot = { x: number; y: number; distance: number; breath: number; twinkle: number; dx: number; dy: number; fx: number; fy: number };

const round = (value: number) => Number(value.toFixed(3));

// An 11×11 grid on 16 px steps, kept to a circle. Every value is fixed, so the field looks the same on every visit.
export function dotField(): Dot[] {
  const dots: Dot[] = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const distance = Math.hypot(row - MIDDLE, col - MIDDLE);
      if (distance > MIDDLE + 0.2) continue;
      const scatter = ((col * 73 + row * 151) % 97) / 97;
      const drift = (((col * 31 + row * 57) % 89) / 89) * 2 * Math.PI;
      dots.push({
        x: col * GAP,
        y: row * GAP,
        distance,
        breath: round(distance * 0.07),
        twinkle: round(scatter * TWINKLE_S),
        dx: distance === 0 ? 0 : round((col - MIDDLE) / distance),
        dy: distance === 0 ? 0 : round((row - MIDDLE) / distance),
        fx: round(Math.cos(drift) * 3),
        fy: round(Math.sin(drift) * 3),
      });
    }
  }
  return dots;
}

// How a dot gets out of the pointer's way: pushed straight away from it, harder the closer it is (eased, so it feels
// soft at the edge of the reach), and a little bigger. Outside the reach it is left alone.
export function pushAway(dot: { x: number; y: number }, pointer: { x: number; y: number }): { x: number; y: number; grow: number } {
  const cx = dot.x + DOT / 2 - pointer.x;
  const cy = dot.y + DOT / 2 - pointer.y;
  const distance = Math.hypot(cx, cy);
  if (distance >= REACH) return { x: 0, y: 0, grow: 1 };
  const strength = (1 - distance / REACH) ** 2;
  const angle = distance === 0 ? 0 : Math.atan2(cy, cx);
  return { x: round(Math.cos(angle) * MAX_PUSH * strength), y: round(Math.sin(angle) * MAX_PUSH * strength), grow: round(1 + 0.8 * strength) };
}

const DOTS = dotField();

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// The assistant's state as a field of white dots you can play with.
// Both animations always run; switching state only turns a strength value (--amp) up or down over 0.7 s, so it never
// restarts a dot: each one glides from where it is. --amp is stepped from here once a frame rather than as a CSS
// transition of a registered property, because Firefox doesn't redraw keyframes that read a transitioning variable
// (they jumped there, while Chrome glided).
// Idle (--amp 0): each dot twinkles and floats on its own. Thinking (--amp 1): the dots also breathe out from the
// centre and back, brighter. Hover: dots near the pointer slide out of its way and glide back when it leaves.
// Each dot is two spans: the outer one breathes and takes the hover push, the inner one floats.
// The keyframes live in globals.css and run even with reduced motion on (the owner asked for the movement).
export function ThinkingDotsComponent({ thinking }: { thinking: boolean }) {
  const field = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const amp = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Glide --amp from wherever it is now to the new state, so a quick switch back mid-way never jumps.
  useEffect(() => {
    const element = field.current;
    const from = amp.current;
    const to = thinking ? 1 : 0;
    if (!element || from === to) return;
    const start = performance.now();
    let ramp = 0;
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / RAMP_MS);
      amp.current = from + (to - from) * easeInOut(progress);
      element.style.setProperty('--amp', amp.current.toFixed(3));
      if (progress < 1) ramp = requestAnimationFrame(step);
    };
    ramp = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ramp);
  }, [thinking]);

  // Hover moves are written straight onto the dots once a frame, never through React state, so the field never re-renders.
  function place(pointer: { x: number; y: number } | null) {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const dots = field.current?.children;
      if (!dots) return;
      DOTS.forEach((dot, index) => {
        const { x, y, grow } = pointer ? pushAway(dot, pointer) : { x: 0, y: 0, grow: 1 };
        const element = dots[index] as HTMLElement;
        element.style.setProperty('--hx', `${x}px`);
        element.style.setProperty('--hy', `${y}px`);
        element.style.setProperty('--grow', String(grow));
      });
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    place({ x: event.clientX - box.left, y: event.clientY - box.top });
  }

  return (
    <div
      ref={field}
      role="img"
      aria-label={thinking ? 'Thinking…' : 'Ready when you are'}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => place(null)}
      className={cn('assistant-field relative size-[166px] touch-none', thinking && 'assistant-field-thinking')}
    >
      {DOTS.map(({ x, y, breath, twinkle, dx, dy, fx, fy }) => (
        <span
          key={`${x}-${y}`}
          className="assistant-dot absolute size-1.5"
          style={
            { left: x, top: y, '--breath-delay': `${breath}s`, '--twinkle-delay': `${twinkle}s`, '--dx': dx, '--dy': dy, '--fx': `${fx}px`, '--fy': `${fy}px` } as CSSProperties
          }
        >
          <span className="assistant-dot-core block size-full rounded-full bg-foreground" />
        </span>
      ))}
    </div>
  );
}
