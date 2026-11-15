'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createKey, fetchKeyStatus, type KeyStatus } from '../src/pipelines-api';

// When the space's key was made and last used. The plain key itself is only ever returned by `create`,
// and the caller keeps it in component state: never in the query cache.
export function usePipelineKey(spaceId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ['pipeline-key', spaceId], queryFn: () => fetchKeyStatus(spaceId), enabled });
  const create = useMutation({
    mutationFn: () => createKey(spaceId),
    onSuccess: () => {
      const made: KeyStatus = { createdAt: new Date().toISOString(), lastUsedAt: null };
      queryClient.setQueryData(['pipeline-key', spaceId], made);
    },
  });
  return { status, create };
}
