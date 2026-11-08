'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useToday } from '@/shared/hooks/useToday';
import { createSubtask, createTask, deleteTask, setTaskFinished, updateTask } from '../src/tasks-api';

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const today = useToday();
  const shared = {
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  };

  return {
    create: useMutation({ mutationFn: createTask, ...shared }),
    createSubtask: useMutation({ mutationFn: createSubtask, ...shared }),
    update: useMutation({ mutationFn: updateTask, ...shared }),
    setFinished: useMutation({
      mutationFn: ({ id, finished }: { id: string; finished: boolean }) =>
        setTaskFinished(id, finished, today),
      ...shared,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteTask(id, today), ...shared }),
  };
}
