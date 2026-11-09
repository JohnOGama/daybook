'use client';

import { useQuery } from '@tanstack/react-query';
import { useToday } from '@/shared/hooks/useToday';
import { fetchTasks } from '../src/tasks-api';

export function useSpaceTodayTasks(spaceId: string) {
  const today = useToday();
  return useQuery({
    queryKey: ['tasks', spaceId, today, today, today],
    queryFn: () => fetchTasks({ spaceId, from: today, to: today, today }),
  });
}
