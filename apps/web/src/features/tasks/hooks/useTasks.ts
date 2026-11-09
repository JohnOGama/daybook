'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { useToday } from '@/shared/hooks/useToday';
import { fetchTasks } from '../src/tasks-api';

export function useTasks({ from, to }: { from: string; to: string }) {
  const today = useToday();
  const spaceId = useActiveSpace()?.id;
  return useQuery({
    queryKey: ['tasks', spaceId, from, to, today],
    queryFn: () => fetchTasks({ spaceId: spaceId as string, from, to, today }),
    enabled: Boolean(spaceId),
  });
}
