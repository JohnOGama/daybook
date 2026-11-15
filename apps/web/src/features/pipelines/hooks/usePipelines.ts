'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchPipelines } from '../src/pipelines-api';

export function usePipelinesSpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'pipelines' ? space.id : undefined;
}

// Refreshed by LiveUpdatesProviderComponent whenever Jenkins reports to this space.
export function usePipelines() {
  const spaceId = usePipelinesSpaceId();
  return useQuery({ queryKey: ['pipelines', spaceId], queryFn: () => fetchPipelines(spaceId as string), enabled: Boolean(spaceId) });
}
