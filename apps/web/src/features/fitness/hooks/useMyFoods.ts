'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchMyFoods } from '../src/fitness-api';
import { useFitnessSpaceId } from './useFitness';

// Shares the food-search key prefix, so saving or deleting a food refreshes it.
export function useMyFoods() {
  const spaceId = useFitnessSpaceId();
  return useQuery({ queryKey: ['fitness-foods', spaceId, { mine: true }], queryFn: () => fetchMyFoods(spaceId as string), enabled: Boolean(spaceId) });
}
