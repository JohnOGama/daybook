'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import type { PipelineStatus, Space, UptimeStatus } from '@/features/spaces';

// The server closes with 4403 when the session is gone; reconnecting can't fix that.
const SIGNED_OUT = 4403;
const MAX_DELAY_MS = 30_000;

type LiveMessage = { type: 'pipeline'; spaceId: string; status: PipelineStatus | null } | { type: 'uptime'; spaceId: string; status: UptimeStatus | null };
const isLiveMessage = (value: unknown): value is LiveMessage =>
  typeof value === 'object' &&
  value !== null &&
  ((value as LiveMessage).type === 'pipeline' || (value as LiveMessage).type === 'uptime') &&
  typeof (value as LiveMessage).spaceId === 'string';

// One socket per signed-in tab (/api/realtime/me) for updates about spaces you aren't looking at: pipeline and uptime status.
// A message only says what changed; the open page refetches through the normal routes, which check access and passwords.
export function LiveUpdatesProviderComponent({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let delay = 1000;
    let opened = false;

    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${scheme}://${window.location.host}/api/realtime/me`);
      socket.onopen = () => {
        delay = 1000;
        // Reports may have arrived while the socket was down.
        if (opened) void queryClient.invalidateQueries({ queryKey: ['spaces'] });
        opened = true;
      };
      socket.onmessage = (event) => {
        let message: unknown;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (!isLiveMessage(message)) return;
        const field = message.type === 'pipeline' ? 'pipelines' : 'uptime';
        queryClient.setQueryData<Space[]>(['spaces'], (spaces) =>
          spaces?.map((space) => (space.id === message.spaceId ? { ...space, [field]: message.status } : space)),
        );
        if (message.type === 'pipeline') {
          void queryClient.invalidateQueries({ queryKey: ['pipelines', message.spaceId] });
          void queryClient.invalidateQueries({ queryKey: ['pipeline-run'] });
        } else {
          void queryClient.invalidateQueries({ queryKey: ['uptime', message.spaceId] });
          void queryClient.invalidateQueries({ queryKey: ['uptime-monitor'] });
        }
      };
      socket.onclose = (event) => {
        if (stopped || event.code === SIGNED_OUT) return;
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, MAX_DELAY_MS);
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient]);

  return children;
}
