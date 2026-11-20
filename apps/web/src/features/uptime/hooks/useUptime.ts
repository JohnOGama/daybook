'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchUptime } from '../src/uptime-api';

export function useUptimeSpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'uptime' ? space.id : undefined;
}

// A status change arrives live (LiveUpdatesProviderComponent); the minute refetch moves response times and bars along.
export function useUptime() {
  const spaceId = useUptimeSpaceId();
  return useQuery({ queryKey: ['uptime', spaceId], queryFn: () => fetchUptime(spaceId as string), enabled: Boolean(spaceId), refetchInterval: 60_000 });
}
