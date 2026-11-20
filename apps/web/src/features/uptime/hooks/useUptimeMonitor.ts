'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMonitor } from '../src/uptime-api';

// Read only while the drawer is open.
export function useUptimeMonitor(id: string | undefined) {
  return useQuery({ queryKey: ['uptime-monitor', id], queryFn: () => fetchMonitor(id as string), enabled: Boolean(id) });
}
