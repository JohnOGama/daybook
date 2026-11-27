'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { IDLE_LOCK_MS, VaultSessionContext } from '../hooks/useVaultSession';

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel'] as const;

export function VaultSessionProviderComponent({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [spaceKeys, setSpaceKeys] = useState<Record<string, CryptoKey>>({});
  const isOpen = key !== null || Object.keys(spaceKeys).length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const lockAll = () => {
      setKey(null);
      setSpaceKeys({});
    };
    let timer = setTimeout(lockAll, IDLE_LOCK_MS);
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(lockAll, IDLE_LOCK_MS);
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, resetTimer, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, resetTimer);
    };
  }, [isOpen]);

  const session = useMemo(
    () => ({
      key,
      spaceKeys,
      unlock: setKey,
      unlockSpace: (spaceId: string, spaceKey: CryptoKey) => setSpaceKeys((current) => ({ ...current, [spaceId]: spaceKey })),
      lock: () => {
        setKey(null);
        setSpaceKeys({});
      },
    }),
    [key, spaceKeys],
  );

  return <VaultSessionContext.Provider value={session}>{children}</VaultSessionContext.Provider>;
}
