'use client';

import { onlineManager, useMutationState } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);

// Changes made offline wait in memory and go out when the connection is back.
// ponytail: the queue lives in this tab only; persist it with a query persister if changes must survive a reload offline
export function useOfflineQueue() {
  const online = useSyncExternalStore(subscribe, () => onlineManager.isOnline(), () => true);
  const waiting = useMutationState({ filters: { status: 'pending', predicate: (mutation) => mutation.state.isPaused } }).length;

  useEffect(() => {
    if (waiting === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [waiting]);

  return { online, waiting };
}
