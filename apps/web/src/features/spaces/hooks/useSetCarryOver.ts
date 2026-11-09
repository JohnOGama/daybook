'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { withCarryOver } from '../src/space-cache';
import { setSpaceCarryOver } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useSetCarryOver() {
  const queryClient = useQueryClient();
  const optimistic = useSpaceOptimism();
  return useMutation({
    ...optimistic(setSpaceCarryOver, (spaces, { id, carryOver }: { id: string; carryOver: boolean }) =>
      withCarryOver(spaces, id, carryOver),
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });
}
