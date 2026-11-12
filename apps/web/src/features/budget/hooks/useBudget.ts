'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchBudget } from '../src/budget-api';

export function useBudget() {
  const space = useActiveSpace();
  const spaceId = space?.tool === 'budget' ? space.id : undefined;
  return useQuery({
    queryKey: ['budget', spaceId],
    queryFn: () => fetchBudget(spaceId as string),
    enabled: Boolean(spaceId),
  });
}
