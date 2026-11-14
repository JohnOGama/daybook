'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchExercises } from '../src/fitness-api';
import { useFitnessSpaceId } from './useFitness';

// The built-in list plus this space's own exercises. It only changes when the owner edits their own.
export function useExercises() {
  const spaceId = useFitnessSpaceId();
  return useQuery({
    queryKey: ['fitness-exercises', spaceId],
    queryFn: () => fetchExercises(spaceId as string),
    enabled: Boolean(spaceId),
    staleTime: Infinity,
  });
}
