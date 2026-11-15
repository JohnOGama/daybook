'use client';

import { useQueryClient } from '@tanstack/react-query';
import * as decoding from 'lib0/decoding';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { authClient } from '@/shared/services/auth-client';
import { type PresenceMember, type SpacePresence, SpacePresenceContext } from '../hooks/useSpacePresence';
import type { Space } from './space-types';

// Matches MESSAGE_MEMBERS in the API's realtime-room.ts: the server's list of who is in the room.
const MESSAGE_MEMBERS = 100;
// The server closes with 4403 when you lost access; y-websocket does not reconnect after it.
const NO_ACCESS = 4403;

// Opens the live connection for one space (same origin, so the session and unlock cookies go with it).
export function SpacePresenceProviderComponent({ space, children }: { space: Space; children: ReactNode }) {
  const [presence, setPresence] = useState<SpacePresence | null>(null);
  const queryClient = useQueryClient();
  const me = authClient.useSession().data?.user.id;
  // Read inside the socket handlers, which are set up once per space.
  const known = useRef({ me, access: space.access });
  known.current = { me, access: space.access };

  useEffect(() => {
    const doc = new Y.Doc();
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // No BroadcastChannel: every change goes through the server, which decides who may make it.
    const provider = new WebsocketProvider(`${scheme}://${window.location.host}/api/realtime`, space.id, doc, { disableBc: true });
    let current: SpacePresence = { doc, awareness: provider.awareness, members: [], connected: false, synced: false, denied: false };
    const publish = (patch: Partial<SpacePresence>) => {
      current = { ...current, ...patch };
      setPresence(current);
    };
    provider.messageHandlers[MESSAGE_MEMBERS] = (_encoder, decoder) => {
      const members = JSON.parse(decoding.readVarString(decoder)) as PresenceMember[];
      publish({ members });
      // Given or lost edit while open: the server already applies it, so refresh the space to match.
      const mine = members.find((member) => member.userId === known.current.me);
      if (mine && mine.access !== known.current.access) void queryClient.invalidateQueries({ queryKey: ['spaces'] });
    };
    provider.on('status', ({ status }) => publish({ connected: status === 'connected' }));
    // Synced once is enough: a dropped connection keeps the page open and resyncs when it comes back.
    provider.on('sync', (synced) => {
      if (synced) publish({ synced: true });
    });
    provider.on('connection-close', (event) => {
      if (event?.code === NO_ACCESS) publish({ denied: true });
    });
    publish({});
    return () => {
      provider.destroy();
      doc.destroy();
    };
  }, [space.id, queryClient]);

  return <SpacePresenceContext.Provider value={presence}>{children}</SpacePresenceContext.Provider>;
}
