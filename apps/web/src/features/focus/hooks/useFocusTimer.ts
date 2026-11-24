'use client';

import { createContext, useContext } from 'react';
import type { FocusSettings, FocusTask, Phase, TimerState } from '../src/focus-types';

export type FocusTimer = {
  timer: TimerState | null;
  now: number;
  // Makes the browser's timer this space's, unless another space's timer is under way. Also takes new lengths.
  prepare: (spaceId: string, settings: FocusSettings) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  choosePhase: (phase: Phase) => void;
  setTask: (task: FocusTask | null) => void;
  // Forgets the timer; it comes back the next time a Focus space is opened.
  clear: () => void;
};

export const FocusTimerContext = createContext<FocusTimer | null>(null);

export function useFocusTimer(): FocusTimer {
  const timer = useContext(FocusTimerContext);
  if (!timer) throw new Error('useFocusTimer needs FocusTimerProviderComponent');
  return timer;
}
