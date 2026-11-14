'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchFitness } from '../src/fitness-api';

export function useFitnessSpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'fitness' ? space.id : undefined;
}

export function useFitness() {
  const spaceId = useFitnessSpaceId();
  return useQuery({ queryKey: ['fitness', spaceId], queryFn: () => fetchFitness(spaceId as string), enabled: Boolean(spaceId) });
}
