'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchSecurity } from '../src/security-api';

export function useSecuritySpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'security' ? space.id : undefined;
}

export function useSecurity() {
  const spaceId = useSecuritySpaceId();
  return useQuery({ queryKey: ['security', spaceId], queryFn: () => fetchSecurity(spaceId as string), enabled: Boolean(spaceId) });
}
