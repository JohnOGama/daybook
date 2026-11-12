'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchUnlocked,
  lockSpaceNow,
  removeSpacePassword,
  type RemovePasswordInput,
  type SetPasswordInput,
  setSpacePassword,
  unlockSpace,
} from '../src/space-lock-api';
import type { Space } from '../src/space-types';

export const canLock = (space?: Pick<Space, 'kind' | 'tool'>) => space?.kind === 'space' && space.tool !== 'vault';

export function useSpaceUnlocked(space?: Space) {
  return useQuery({
    queryKey: ['space-lock', space?.id],
    queryFn: () => fetchUnlocked(space?.id as string),
    enabled: Boolean(space?.locked && canLock(space)),
  });
}

export function useSpaceLock() {
  const queryClient = useQueryClient();

  function settle(id: string, { locked, unlocked }: { locked?: boolean; unlocked: boolean }) {
    queryClient.setQueryData(['space-lock', id], unlocked);
    if (locked !== undefined) {
      queryClient.setQueriesData<Space[]>({ queryKey: ['spaces'] }, (spaces) =>
        spaces?.map((space) => (space.id === id ? { ...space, locked } : space)),
      );
    }
    if (!unlocked) {
      queryClient.removeQueries({ queryKey: ['tasks', id] });
      queryClient.removeQueries({ queryKey: ['pages', id] });
    }
    void queryClient.invalidateQueries({ queryKey: ['trash'] });
  }

  return {
    unlock: useMutation({
      mutationFn: unlockSpace,
      onSuccess: (_, { id }) => settle(id, { unlocked: true }),
    }),
    lockNow: useMutation({
      mutationFn: lockSpaceNow,
      onSuccess: (_, id) => settle(id, { unlocked: false }),
      onError: (error: Error) => toast.error(error.message),
    }),
    setPassword: useMutation({
      mutationFn: (input: SetPasswordInput) => setSpacePassword(input),
      onSuccess: (_, { id }) => settle(id, { locked: true, unlocked: true }),
    }),
    removePassword: useMutation({
      mutationFn: (input: RemovePasswordInput) => removeSpacePassword(input),
      onSuccess: (_, { id }) => settle(id, { locked: false, unlocked: true }),
    }),
  };
}
