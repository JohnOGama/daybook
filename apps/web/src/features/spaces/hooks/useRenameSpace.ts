'use client';

import { useMutation } from '@tanstack/react-query';
import { renameSpace } from '../src/space-cache';
import { updateSpaceTitle } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useRenameSpace() {
  const optimistic = useSpaceOptimism();
  return useMutation(
    optimistic(updateSpaceTitle, (spaces, { id, title }: { id: string; title: string }) =>
      renameSpace(spaces, id, title),
    ),
  );
}
