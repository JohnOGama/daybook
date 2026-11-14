'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchVersion, fetchVersions } from '../src/pages-api';

// History is only read while its panel is open, and re-read each time, since editing adds to it.
export function usePageVersions(pageId: string, enabled: boolean) {
  return useQuery({ queryKey: ['page-versions', pageId], queryFn: () => fetchVersions(pageId), enabled, staleTime: 0, gcTime: 0 });
}

export function usePageVersion(pageId: string, versionId: string | undefined) {
  return useQuery({
    queryKey: ['page-versions', pageId, versionId],
    queryFn: () => fetchVersion(pageId, versionId as string),
    enabled: Boolean(versionId),
    staleTime: Infinity,
  });
}
