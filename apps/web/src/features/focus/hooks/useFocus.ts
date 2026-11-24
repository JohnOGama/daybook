'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActiveSpace } from '@/features/spaces';
import { addDays } from '@/shared/utils/date-formatter';
import { fetchFocus, saveFocusSettings } from '../src/focus-api';
import type { FocusSettings, FocusView } from '../src/focus-types';

export function useFocusSpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'focus' ? space.id : undefined;
}

// The space's timer lengths and its sessions over the last 7 days.
export function useFocus(today: string) {
  const spaceId = useFocusSpaceId();
  const from = addDays(today, -6);
  return useQuery({
    queryKey: ['focus', spaceId, from, today],
    queryFn: () => fetchFocus(spaceId as string, from, today),
    enabled: Boolean(spaceId),
  });
}

export function useSaveFocusSettings() {
  const queryClient = useQueryClient();
  const spaceId = useFocusSpaceId() as string;
  const key = ['focus', spaceId];
  return useMutation({
    mutationFn: (settings: FocusSettings) => saveFocusSettings({ spaceId, settings }),
    onMutate: async (settings: FocusSettings) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueriesData<FocusView>({ queryKey: key });
      queryClient.setQueriesData<FocusView>({ queryKey: key }, (view) => view && { ...view, settings });
      return previous;
    },
    onError: (error: Error, _settings, previous) => {
      for (const [queryKey, data] of previous ?? []) queryClient.setQueryData(queryKey, data);
      toast.error(error.message);
    },
  });
}
