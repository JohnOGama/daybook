'use client';

import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Space } from '../src/space-types';

type Snapshot = [QueryKey, Space[] | undefined][];

export function useSpaceOptimism() {
  const queryClient = useQueryClient();

  return function optimistic<V, R>(
    mutationFn: (variables: V) => Promise<R>,
    patch: (spaces: Space[], variables: V) => Space[],
  ) {
    return {
      mutationFn,
      onMutate: async (variables: V): Promise<Snapshot> => {
        await queryClient.cancelQueries({ queryKey: ['spaces'] });
        const snapshot = queryClient.getQueriesData<Space[]>({ queryKey: ['spaces'] });
        queryClient.setQueriesData<Space[]>({ queryKey: ['spaces'] }, (spaces) => spaces && patch(spaces, variables));
        return snapshot;
      },
      onError: (error: Error, _variables: V, snapshot: Snapshot | undefined) => {
        for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
        toast.error(error.message);
      },
    };
  };
}
