'use client';

import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { addSpace, buildSpace } from '../src/space-cache';
import type { CreateSpaceInput, NewSpaceInput } from '../src/space-types';
import { createSpace } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useCreateSpace() {
  const optimistic = useSpaceOptimism();
  const mutation = useMutation({
    ...optimistic(createSpace, (spaces, input: NewSpaceInput) => addSpace(spaces, buildSpace(input))),
    onSuccess: (_result, { title }) => toast.success(`Created "${title}"`),
  });
  return {
    mutateAsync: (input: CreateSpaceInput) => mutation.mutateAsync({ ...input, id: crypto.randomUUID() }),
  };
}
