'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchDays } from '../src/fitness-api';
import { useFitnessSpaceId } from './useFitness';

// Food logs and workouts for an inclusive range of days.
export function useFitnessDays(from: string, to: string) {
  const spaceId = useFitnessSpaceId();
  return useQuery({
    queryKey: ['fitness-days', spaceId, from, to],
    queryFn: () => fetchDays(spaceId as string, from, to),
    enabled: Boolean(spaceId),
  });
}
