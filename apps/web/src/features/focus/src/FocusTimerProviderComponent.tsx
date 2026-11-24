'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { chime } from '@/shared/utils/chime';
import { type FocusTimer, FocusTimerContext } from '../hooks/useFocusTimer';
import { addFocusSession } from './focus-api';
import * as clock from './focus-math';
import type { FocusSession, FocusSettings, FocusView, TimerState } from './focus-types';

const STORAGE_KEY = 'daybook-focus-timer';
const TICK_MS = 500;
const newId = () => crypto.randomUUID();

function readStored(): TimerState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as TimerState) : null;
  } catch {
    return null;
  }
}

function store(timer: TimerState | null) {
  try {
    if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the timer still runs; it just won't survive a reload.
  }
}

// Shown as a desktop notification only while the tab is in the background; the toast and tone cover the rest.
function announce(text: string) {
  chime();
  toast(text);
  try {
    if (document.visibilityState === 'hidden' && Notification.permission === 'granted') new Notification('Daybook', { body: text });
  } catch {
    // No notifications in this browser.
  }
}

function askToNotify() {
  try {
    if (Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    // No notifications in this browser.
  }
}

const finishedText = (next: TimerState) =>
  next.phase === 'focus'
    ? 'Break over. Ready for the next focus?'
    : `Focus done. Take a ${clock.phaseMs(next.phase, next.settings) / 60_000} minute ${next.phase === 'long' ? 'long break' : 'break'}.`;

// One timer per browser, kept in localStorage, so it keeps counting while you work elsewhere in Daybook,
// survives a reload, and follows you across tabs. A finished focus phase is recorded as a session.
export function FocusTimerProviderComponent({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [timer, setTimerState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Nothing may replace the stored timer before it has been read back.
  const [loaded, setLoaded] = useState(false);

  const setTimer = useCallback((next: TimerState | null) => {
    setTimerState(next);
    store(next);
  }, []);

  useEffect(() => {
    setTimerState(readStored());
    setLoaded(true);
    const onStorage = (event: StorageEvent) => event.key === STORAGE_KEY && setTimerState(readStored());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const running = timer !== null && clock.isRunning(timer);
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(tick);
  }, [running]);

  const record = useCallback(
    (spaceId: string, session: FocusSession) => {
      queryClient.setQueriesData<FocusView>({ queryKey: ['focus', spaceId] }, (view) => view && { ...view, sessions: [...view.sessions.filter(({ id }) => id !== session.id), session] });
      // ponytail: no retry queue; a session lost to a dropped connection is gone. Queue it if that happens in practice.
      addFocusSession(spaceId, session).catch((error: Error) => toast.error(error.message));
    },
    [queryClient],
  );

  useEffect(() => {
    if (!timer || timer.endsAt === null || now < timer.endsAt) return;
    const { next, session } = clock.finish(timer, newId);
    setTimer(next);
    if (session) record(timer.spaceId, session);
    announce(finishedText(next));
  }, [timer, now, setTimer, record]);

  const value = useMemo<FocusTimer>(() => {
    const change = (update: (current: TimerState) => TimerState) => timer && setTimer(update(timer));
    return {
      timer,
      now,
      prepare: (spaceId: string, settings: FocusSettings) => {
        if (!loaded) return;
        if (!timer || (timer.spaceId !== spaceId && !clock.isActive(timer))) setTimer(clock.idleTimer(spaceId, settings, newId));
        else if (timer.spaceId === spaceId && JSON.stringify(timer.settings) !== JSON.stringify(settings)) setTimer(clock.withSettings(timer, settings));
      },
      start: () => {
        askToNotify();
        const startedAt = Date.now();
        setNow(startedAt);
        change((current) => clock.start(current, startedAt));
      },
      pause: () => change((current) => clock.pause(current, Date.now())),
      reset: () => change(clock.reset),
      skip: () => change((current) => clock.skip(current, newId)),
      choosePhase: (phase) => change((current) => clock.choosePhase(current, phase)),
      setTask: (task) => change((current) => ({ ...current, task })),
      clear: () => setTimer(null),
    };
  }, [timer, now, loaded, setTimer]);

  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
}
