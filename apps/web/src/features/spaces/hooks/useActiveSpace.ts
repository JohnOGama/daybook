'use client';

import { useSearchParams } from 'next/navigation';
import { resolveActiveSpace } from '../src/space-tree';
import { useSpaces } from './useSpaces';

export function useActiveSpace() {
  const { data: spaces = [] } = useSpaces();
  return resolveActiveSpace(spaces, useSearchParams().get('space'));
}
