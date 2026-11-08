'use client';

import { useQuery } from '@tanstack/react-query';
import { useToday } from '@/shared/hooks/useToday';
import { fetchTasks } from '../src/tasks-api';

export function useTasks({ from, to }: { from: string; to: string }) {
  const today = useToday();
  return useQuery({
    queryKey: ['tasks', from, to, today],
    queryFn: () => fetchTasks({ from, to, today }),
  });
}
