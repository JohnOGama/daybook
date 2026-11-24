import { addDays, localDay } from '@/shared/utils/date-formatter';
import type { FocusSession, FocusSettings, FocusTask, Phase, TimerState } from './focus-types';

const MINUTE_MS = 60_000;

export function phaseMs(phase: Phase, settings: FocusSettings): number {
  const minutes = phase === 'focus' ? settings.focusMinutes : phase === 'short' ? settings.shortBreakMinutes : settings.longBreakMinutes;
  return minutes * MINUTE_MS;
}

export function idleTimer(spaceId: string, settings: FocusSettings, newId: () => string, task: FocusTask | null = null): TimerState {
  return { spaceId, phase: 'focus', endsAt: null, leftMs: phaseMs('focus', settings), startedAt: null, sessionId: newId(), completed: 0, task, settings };
}

export const isRunning = (timer: TimerState) => timer.endsAt !== null;

// Started at some point and not reset: running, or paused part way.
export const isActive = (timer: TimerState) => isRunning(timer) || timer.leftMs !== phaseMs(timer.phase, timer.settings);

export const leftAt = (timer: TimerState, now: number) => (timer.endsAt === null ? timer.leftMs : Math.max(timer.endsAt - now, 0));

export function start(timer: TimerState, now: number): TimerState {
  if (isRunning(timer)) return timer;
  const startedAt = timer.phase === 'focus' ? (timer.startedAt ?? new Date(now).toISOString()) : timer.startedAt;
  return { ...timer, endsAt: now + timer.leftMs, startedAt };
}

export const pause = (timer: TimerState, now: number): TimerState => (isRunning(timer) ? { ...timer, endsAt: null, leftMs: leftAt(timer, now) } : timer);

// Back to the start of the same phase; a focus session that was under way is dropped.
export const reset = (timer: TimerState): TimerState => ({ ...timer, endsAt: null, leftMs: phaseMs(timer.phase, timer.settings), startedAt: null });

// Only while nothing is under way, so a running session is never thrown away by a stray click.
export function choosePhase(timer: TimerState, phase: Phase): TimerState {
  if (isActive(timer)) return timer;
  return { ...timer, phase, endsAt: null, leftMs: phaseMs(phase, timer.settings), startedAt: null };
}

// New lengths apply at once to a timer that hasn't started; one under way keeps the length it began with.
export function withSettings(timer: TimerState, settings: FocusSettings): TimerState {
  if (isActive(timer)) return { ...timer, settings };
  return { ...timer, settings, leftMs: phaseMs(timer.phase, settings) };
}

function afterFocus(timer: TimerState, completed: number, newId: () => string): TimerState {
  const phase: Phase = completed % timer.settings.longBreakEvery === 0 ? 'long' : 'short';
  return { ...timer, phase, endsAt: null, leftMs: phaseMs(phase, timer.settings), startedAt: null, sessionId: newId(), completed };
}

function toFocus(timer: TimerState): TimerState {
  return { ...timer, phase: 'focus', endsAt: null, leftMs: phaseMs('focus', timer.settings), startedAt: null };
}

// The phase ran out. A focus phase becomes a session to record; the next phase waits for Start.
export function finish(timer: TimerState, newId: () => string): { next: TimerState; session: FocusSession | null } {
  if (timer.phase !== 'focus') return { next: toFocus(timer), session: null };
  const endsAt = timer.endsAt ?? Date.now();
  const session: FocusSession = {
    id: timer.sessionId,
    day: localDay(new Date(endsAt)),
    startedAt: timer.startedAt ?? new Date(endsAt - phaseMs('focus', timer.settings)).toISOString(),
    minutes: timer.settings.focusMinutes,
    taskId: timer.task?.id ?? null,
    taskTitle: timer.task?.title ?? null,
  };
  return { next: afterFocus(timer, timer.completed + 1, newId), session };
}

// Moves on without recording: a skipped focus goes to a short break and doesn't count towards the long one.
export function skip(timer: TimerState, newId: () => string): TimerState {
  if (timer.phase !== 'focus') return toFocus(timer);
  return { ...afterFocus(timer, timer.completed, newId), phase: 'short', leftMs: phaseMs('short', timer.settings) };
}

export function formatClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes % 60 === 0 ? `${hours} h` : `${hours} h ${minutes % 60} min`;
}

export const lastWeek = (today: string) => Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

export function minutesByDay(sessions: FocusSession[], days: string[]): { day: string; minutes: number }[] {
  return days.map((day) => ({ day, minutes: sessions.filter((session) => session.day === day).reduce((total, session) => total + session.minutes, 0) }));
}

// Focus time per task, most first. Sessions with no task count together as "No task".
export function byTask(sessions: FocusSession[]): { key: string; title: string; minutes: number; count: number }[] {
  const totals = new Map<string, { key: string; title: string; minutes: number; count: number }>();
  for (const session of sessions) {
    const key = session.taskId ?? session.taskTitle ?? '';
    const total = totals.get(key) ?? { key, title: session.taskTitle ?? 'No task', minutes: 0, count: 0 };
    totals.set(key, { ...total, minutes: total.minutes + session.minutes, count: total.count + 1 });
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}
