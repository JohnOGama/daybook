'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchJobs } from '../src/jobs-api';

export function useJobsSpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'jobs' ? space.id : undefined;
}

export function useJobs() {
  const spaceId = useJobsSpaceId();
  return useQuery({ queryKey: ['jobs', spaceId], queryFn: () => fetchJobs(spaceId as string), enabled: Boolean(spaceId) });
}
