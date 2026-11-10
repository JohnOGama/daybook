'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { IDLE_LOCK_MS, VaultSessionContext } from '../hooks/useVaultSession';

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;

export function VaultSessionProviderComponent({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    if (!key) return;
    let timer = setTimeout(() => setKey(null), IDLE_LOCK_MS);
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setKey(null), IDLE_LOCK_MS);
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, resetTimer, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, resetTimer);
    };
  }, [key]);

  const session = useMemo(() => ({ key, unlock: setKey, lock: () => setKey(null) }), [key]);

  return <VaultSessionContext.Provider value={session}>{children}</VaultSessionContext.Provider>;
}
