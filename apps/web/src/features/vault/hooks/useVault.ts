'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchVault } from '../src/vault-api';

export function useVault() {
  return useQuery({ queryKey: ['vault'], queryFn: fetchVault });
}
