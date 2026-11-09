'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchPages } from '../src/pages-api';

export function usePages() {
  const space = useActiveSpace();
  const spaceId = space?.tool === 'notebook' ? space.id : undefined;
  return useQuery({
    queryKey: ['pages', spaceId],
    queryFn: () => fetchPages(spaceId as string),
    enabled: Boolean(spaceId),
  });
}
