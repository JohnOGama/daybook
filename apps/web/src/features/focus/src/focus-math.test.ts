import { expect, it } from 'vitest';
import { byTask, choosePhase, finish, formatClock, formatMinutes, idleTimer, isActive, leftAt, minutesByDay, pause, reset, skip, start, withSettings } from './focus-math';
import { DEFAULT_SETTINGS, type FocusSession, type TimerState } from './focus-types';

let counter = 0;
const newId = () => `id-${++counter}`;
const MIN = 60_000;
const at = Date.parse('2026-11-24T09:00:00.000Z');

it('counts down while running and keeps what is left while paused', () => {
  const timer = start(idleTimer('s1', DEFAULT_SETTINGS, newId), at);
  expect(timer.startedAt).toBe('2026-11-24T09:00:00.000Z');
  expect(leftAt(timer, at + 10 * MIN)).toBe(15 * MIN);
  const paused = pause(timer, at + 10 * MIN);
  expect(leftAt(paused, at + 60 * MIN)).toBe(15 * MIN);
  const resumed = start(paused, at + 60 * MIN);
  expect(resumed.startedAt).toBe('2026-11-24T09:00:00.000Z');
  expect(leftAt(resumed, at + 70 * MIN)).toBe(5 * MIN);
});

it('records a finished focus with its task, then waits on a short break, and a long one every 4th', () => {
  let timer: TimerState = { ...idleTimer('s1', DEFAULT_SETTINGS, newId), task: { id: 't1', spaceId: 'list', title: 'Write report' } };
  const sessions: FocusSession[] = [];
  for (let round = 0; round < 4; round++) {
    const { next, session } = finish(start(timer, at), newId);
    sessions.push(session as FocusSession);
    expect(next.endsAt).toBeNull();
    expect(next.phase).toBe(round === 3 ? 'long' : 'short');
    timer = finish(start(next, at), newId).next;
    expect(timer.phase).toBe('focus');
  }
  expect(sessions[0]).toMatchObject({ minutes: 25, taskId: 't1', taskTitle: 'Write report', startedAt: '2026-11-24T09:00:00.000Z' });
  expect(new Set(sessions.map((session) => session.id)).size).toBe(4);
  expect(timer.completed).toBe(4);
});

it('skips a focus without counting it, resets to the start, and only switches phase when nothing is under way', () => {
  const timer = start(idleTimer('s1', DEFAULT_SETTINGS, newId), at);
  expect(choosePhase(timer, 'long')).toBe(timer);
  const skipped = skip(timer, newId);
  expect(skipped).toMatchObject({ phase: 'short', completed: 0, endsAt: null });
  expect(isActive(reset(pause(timer, at + MIN)))).toBe(false);
  expect(choosePhase(reset(timer), 'long')).toMatchObject({ phase: 'long', leftMs: 15 * MIN });
});

it('applies new lengths to an idle timer, but not to one under way', () => {
  const longer = { ...DEFAULT_SETTINGS, focusMinutes: 50 };
  expect(withSettings(idleTimer('s1', DEFAULT_SETTINGS, newId), longer).leftMs).toBe(50 * MIN);
  const paused = pause(start(idleTimer('s1', DEFAULT_SETTINGS, newId), at), at + MIN);
  expect(withSettings(paused, longer).leftMs).toBe(24 * MIN);
});

it('formats the clock, durations, days and task totals', () => {
  expect(formatClock(25 * MIN)).toBe('25:00');
  expect(formatClock(61_001)).toBe('01:02');
  expect(formatMinutes(25)).toBe('25 min');
  expect(formatMinutes(100)).toBe('1 h 40 min');
  expect(formatMinutes(120)).toBe('2 h');
  const session = (day: string, taskId: string | null, taskTitle: string | null): FocusSession => ({ id: newId(), day, startedAt: '', minutes: 25, taskId, taskTitle });
  const sessions = [session('2026-11-24', 't1', 'Report'), session('2026-11-24', 't1', 'Report'), session('2026-11-23', null, null)];
  expect(minutesByDay(sessions, ['2026-11-23', '2026-11-24'])).toEqual([
    { day: '2026-11-23', minutes: 25 },
    { day: '2026-11-24', minutes: 50 },
  ]);
  expect(byTask(sessions)).toEqual([
    { key: 't1', title: 'Report', minutes: 50, count: 2 },
    { key: '', title: 'No task', minutes: 25, count: 1 },
  ]);
});
