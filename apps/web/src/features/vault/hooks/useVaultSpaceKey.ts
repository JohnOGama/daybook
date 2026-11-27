'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchSpaceKey } from '../src/vault-api';
import { unlockSpaceAsOwner } from '../src/vault-crypto';
import { useVaultSession } from './useVaultSession';

// The space's sharing key, null while it has no sharing passcode.
export function useVaultSpaceKey(spaceId: string) {
  return useQuery({ queryKey: ['vault-space-key', spaceId], queryFn: () => fetchSpaceKey(spaceId), enabled: spaceId !== '' });
}

// The key that opens this space's items: the space's own key once it has a sharing passcode, else the person's vault
// key. The owner's copy of the space key is opened from their vault key as soon as both are here.
export function useItemKey(spaceId: string): CryptoKey | null {
  const { key, spaceKeys = {}, unlockSpace } = useVaultSession();
  const { data: wrap } = useVaultSpaceKey(spaceId);
  const spaceKey = spaceKeys[spaceId];
  const ownerWrappedKey = wrap?.ownerWrappedKey;

  useEffect(() => {
    if (!key || !ownerWrappedKey || spaceKey || !unlockSpace) return;
    void unlockSpaceAsOwner(ownerWrappedKey, key).then((opened) => unlockSpace(spaceId, opened));
  }, [key, ownerWrappedKey, spaceKey, spaceId, unlockSpace]);

  if (wrap === undefined) return null;
  return wrap ? (spaceKey ?? null) : key;
}
