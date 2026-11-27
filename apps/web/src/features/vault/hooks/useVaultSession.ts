'use client';

import { createContext, useContext } from 'react';

export const IDLE_LOCK_MS = 300_000;

export type VaultSession = {
  // The person's own vault key, for their unshared Vaults.
  key: CryptoKey | null;
  // Shared Vaults' own keys by space id, opened with the sharing passcode or, for the owner, with `key`.
  spaceKeys?: Record<string, CryptoKey>;
  unlock: (key: CryptoKey) => void;
  unlockSpace?: (spaceId: string, key: CryptoKey) => void;
  lock: () => void;
};

export const VaultSessionContext = createContext<VaultSession | null>(null);

export function useVaultSession(): VaultSession {
  const session = useContext(VaultSessionContext);
  if (!session) throw new Error('useVaultSession must be used inside VaultSessionProviderComponent');
  return session;
}
