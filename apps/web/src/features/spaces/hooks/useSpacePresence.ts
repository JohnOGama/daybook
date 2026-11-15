'use client';

import { createContext, useContext } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import type { SpaceAccess } from '../src/space-types';

// One person in the open space, as the server knows them. `clientIds` are their tabs' Yjs awareness ids.
export type PresenceMember = { userId: string; name: string; image: string | null; access: SpaceAccess; clientIds: number[] };

export type SpacePresence = { doc: Y.Doc; awareness: Awareness; members: PresenceMember[]; connected: boolean; synced: boolean };

export const SpacePresenceContext = createContext<SpacePresence | null>(null);

// The live connection for the active space; null outside a space, in a Vault and in folders.
export function useSpacePresence(): SpacePresence | null {
  return useContext(SpacePresenceContext);
}
