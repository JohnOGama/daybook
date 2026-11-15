'use client';

import * as decoding from 'lib0/decoding';
import { type ReactNode, useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { type PresenceMember, type SpacePresence, SpacePresenceContext } from '../hooks/useSpacePresence';
import type { Space } from './space-types';

// Matches MESSAGE_MEMBERS in the API's realtime-room.ts: the server's list of who is in the room.
const MESSAGE_MEMBERS = 100;

// Opens the live connection for one space (same origin, so the session and unlock cookies go with it).
export function SpacePresenceProviderComponent({ space, children }: { space: Space; children: ReactNode }) {
  const [presence, setPresence] = useState<SpacePresence | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // No BroadcastChannel: every change goes through the server, which decides who may make it.
    const provider = new WebsocketProvider(`${scheme}://${window.location.host}/api/realtime`, space.id, doc, { disableBc: true });
    let current: SpacePresence = { doc, awareness: provider.awareness, members: [], connected: false, synced: false };
    const publish = (patch: Partial<SpacePresence>) => {
      current = { ...current, ...patch };
      setPresence(current);
    };
    provider.messageHandlers[MESSAGE_MEMBERS] = (_encoder, decoder) => {
      publish({ members: JSON.parse(decoding.readVarString(decoder)) as PresenceMember[] });
    };
    provider.on('status', ({ status }) => publish({ connected: status === 'connected' }));
    provider.on('sync', (synced) => publish({ synced }));
    publish({});
    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [space.id]);

  return <SpacePresenceContext.Provider value={presence}>{children}</SpacePresenceContext.Provider>;
}
