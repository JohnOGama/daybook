'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { restoreItem } from '../src/trash-api';
import type { TrashItem } from '../src/trash-types';

export function useRestoreItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: restoreItem,
    onMutate: async (item: TrashItem) => {
      await queryClient.cancelQueries({ queryKey: ['trash'] });
      const previous = queryClient.getQueryData<TrashItem[]>(['trash']);
      queryClient.setQueryData<TrashItem[]>(['trash'], (items) => items?.filter(({ id }) => id !== item.id));
      return previous;
    },
    onError: (error: Error, _item, previous) => {
      queryClient.setQueryData(['trash'], previous);
      toast.error(error.message);
    },
    onSuccess: (_result, item) => {
      toast.success(`Restored "${item.title}"`);
      void queryClient.invalidateQueries({ queryKey: ['spaces'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['pages'] });
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
    },
  });
}
