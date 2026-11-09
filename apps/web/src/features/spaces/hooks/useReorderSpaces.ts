'use client';

import { useMutation } from '@tanstack/react-query';
import { applySpaceOrder } from '../src/space-cache';
import { reorderSpaces } from '../src/spaces-api';
import { useSpaceOptimism } from './useSpaceOptimism';

export function useReorderSpaces() {
  const optimistic = useSpaceOptimism();
  return useMutation(optimistic(reorderSpaces, (spaces, ids: string[]) => applySpaceOrder(spaces, ids)));
}
