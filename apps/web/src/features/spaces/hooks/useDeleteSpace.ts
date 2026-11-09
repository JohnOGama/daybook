'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeSpace } from '../src/space-cache';
import { deleteSpace } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  const optimistic = useSpaceOptimism();
  return useMutation({
    ...optimistic(deleteSpace, (spaces, id: string) => removeSpace(spaces, id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });
}
