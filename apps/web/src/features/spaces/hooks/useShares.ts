'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { removeSpace } from '../src/space-cache';
import type { Share, ShareRole } from '../src/space-types';
import { addShare, fetchShares, leaveShare, removeShare, setShareRole } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useShares(spaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['space-shares', spaceId];
  const query = useQuery({ queryKey, queryFn: () => fetchShares(spaceId) });

  function optimistic<V>(mutationFn: (variables: V) => Promise<void>, patch: (shares: Share[], variables: V) => Share[]) {
    return {
      mutationFn,
      onMutate: async (variables: V) => {
        await queryClient.cancelQueries({ queryKey });
        const snapshot = queryClient.getQueryData<Share[]>(queryKey);
        queryClient.setQueryData<Share[]>(queryKey, (shares = []) => patch(shares, variables));
        return { snapshot };
      },
      onError: (error: Error, _variables: V, context?: { snapshot?: Share[] }) => {
        queryClient.setQueryData(queryKey, context?.snapshot);
        toast.error(error.message);
      },
    };
  }

  const add = useMutation(
    optimistic((share: Share) => addShare({ spaceId, ...share }), (shares, share) => [...shares, share]),
  );
  const setRole = useMutation(
    optimistic(
      ({ shareId, role }: { shareId: string; role: ShareRole }) => setShareRole({ spaceId, shareId, role }),
      (shares, { shareId, role }) => shares.map((share) => (share.id === shareId ? { ...share, role } : share)),
    ),
  );
  const remove = useMutation(
    optimistic(
      (shareId: string) => removeShare({ spaceId, shareId }),
      (shares, shareId) => shares.filter((share) => share.id !== shareId),
    ),
  );

  return { ...query, add, setRole, remove };
}

export function useLeaveShare() {
  const optimistic = useSpaceOptimism();
  return useMutation(optimistic(leaveShare, (spaces, spaceId: string) => removeSpace(spaces, spaceId)));
}
