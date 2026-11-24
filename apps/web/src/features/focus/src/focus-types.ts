export type FocusSettings = { focusMinutes: number; shortBreakMinutes: number; longBreakMinutes: number; longBreakEvery: number };

export const DEFAULT_SETTINGS: FocusSettings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

// A finished focus session. The task is copied in, so history never changes when the task does.
export type FocusSession = { id: string; day: string; startedAt: string; minutes: number; taskId: string | null; taskTitle: string | null };

export type FocusView = { settings: FocusSettings; sessions: FocusSession[] };

export type Phase = 'focus' | 'short' | 'long';

export const PHASE_LABELS: Record<Phase, string> = { focus: 'Focus', short: 'Short break', long: 'Long break' };

// What a session is about: a task pulled from a List space (with its id and space), or something typed in.
export type FocusTask = { id: string | null; spaceId: string | null; title: string };

// The one timer in this browser. While it runs `endsAt` is set; while it waits, `leftMs` is what remains.
// `startedAt` is set once the focus phase first starts, and `sessionId` names the session it will record.
export type TimerState = {
  spaceId: string;
  phase: Phase;
  endsAt: number | null;
  leftMs: number;
  startedAt: string | null;
  sessionId: string;
  completed: number;
  task: FocusTask | null;
  settings: FocusSettings;
};
