'use client';

import { useMutation } from '@tanstack/react-query';
import { moveSpace } from '../src/space-cache';
import { setSpaceParent } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useMoveSpace() {
  const optimistic = useSpaceOptimism();
  return useMutation(
    optimistic(setSpaceParent, (spaces, { id, parentId }: { id: string; parentId: string | null }) =>
      moveSpace(spaces, id, parentId),
    ),
  );
}
