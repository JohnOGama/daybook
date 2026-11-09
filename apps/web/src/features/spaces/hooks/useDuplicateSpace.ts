'use client';

import { useMutation } from '@tanstack/react-query';
import { addSpace, duplicateOf } from '../src/space-cache';
import type { Space } from '../src/space-types';
import { duplicateSpace } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useDuplicateSpace() {
  const optimistic = useSpaceOptimism();
  const mutation = useMutation(
    optimistic(duplicateSpace, (spaces, { source, id }: { source: Space; id: string }) =>
      addSpace(spaces, duplicateOf(source, id)),
    ),
  );
  return { mutate: (source: Space) => mutation.mutate({ source, id: crypto.randomUUID() }) };
}
