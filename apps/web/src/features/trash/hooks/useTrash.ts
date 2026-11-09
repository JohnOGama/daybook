'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTrash } from '../src/trash-api';

export function useTrash() {
  return useQuery({ queryKey: ['trash'], queryFn: fetchTrash, staleTime: 0 });
}
