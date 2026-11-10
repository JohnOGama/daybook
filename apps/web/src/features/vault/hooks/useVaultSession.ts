'use client';

import { createContext, useContext } from 'react';

export const IDLE_LOCK_MS = 300_000;

export type VaultSession = {
  key: CryptoKey | null;
  unlock: (key: CryptoKey) => void;
  lock: () => void;
};

export const VaultSessionContext = createContext<VaultSession | null>(null);

export function useVaultSession(): VaultSession {
  const session = useContext(VaultSessionContext);
  if (!session) throw new Error('useVaultSession must be used inside VaultSessionProviderComponent');
  return session;
}
