'use client';

import { useQuery } from '@tanstack/react-query';
import { useToday } from '@/shared/hooks/useToday';
import { fetchSpaces } from '../src/spaces-api';

export function useSpaces() {
  const today = useToday();
  return useQuery({ queryKey: ['spaces', today], queryFn: () => fetchSpaces(today) });
}
