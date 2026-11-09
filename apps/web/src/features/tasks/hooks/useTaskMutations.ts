'use client';

import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type Space, useActiveSpace } from '@/features/spaces';
import { useToday } from '@/shared/hooks/useToday';
import { sidebarCounts } from '../src/day-summary';
import { countOf, describeTaskList, type PastedTask, totalInList } from '../src/parse-task-list';
import {
  allInTree,
  buildCopy,
  buildSubtask,
  buildSubtaskTree,
  buildTask,
  findFamily,
  findTask,
  type NewPastedTask,
  upsertTask,
  withDay,
  withFields,
  withFinished,
  withoutSubtask,
  withSubtask,
} from '../src/task-cache';
import { applyOrder } from '../src/task-order';
import type { Task, TaskStatus } from '../src/task-types';
import {
  copyTask,
  createSubtask,
  createSubtasks,
  createTask,
  createTasks,
  deleteTask,
  deleteTasks,
  reorderTasks,
  setTaskFinished,
  type TaskChanges,
  type TaskFields,
  updateTask,
} from '../src/tasks-api';

type Snapshot = [QueryKey, unknown][];
type CopyVariables = { id: string; targetSpaceId?: string; newIds?: Record<string, string> };

const withNewIds = (list: PastedTask[]): NewPastedTask[] =>
  list.map(({ title, subtasks }) => ({ id: crypto.randomUUID(), title, subtasks: withNewIds(subtasks) }));

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const today = useToday();
  const spaceId = useActiveSpace()?.id as string;

  const taskCaches = () => queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });

  function familyOf(id: string): Task | undefined {
    for (const [, tasks] of taskCaches()) {
      const family = tasks && findFamily(tasks, id);
      if (family) return family;
    }
    return undefined;
  }

  function writeFamily(next: Task, targetSpaceId = spaceId) {
    for (const [key, tasks] of taskCaches()) {
      if (!tasks || key[1] !== targetSpaceId) continue;
      queryClient.setQueryData(key, upsertTask(tasks, { from: key[2] as string, to: key[3] as string }, next));
    }
  }

  function dropTask(id: string) {
    for (const [key, tasks] of taskCaches()) {
      if (tasks) queryClient.setQueryData(key, tasks.filter((task) => task.id !== id));
    }
  }

  function changeFamily(id: string, change: (family: Task) => Task) {
    const family = familyOf(id);
    if (family) writeFamily(change(family));
  }

  function refreshOpenCount() {
    const todayTasks = queryClient.getQueryData<Task[]>(['tasks', spaceId, today, today, today]);
    if (!todayTasks) return;
    const { open } = sidebarCounts(todayTasks);
    queryClient.setQueriesData<Space[]>({ queryKey: ['spaces'] }, (spaces) =>
      spaces?.map((space) => (space.id === spaceId ? { ...space, openToday: open } : space)),
    );
  }

  function optimistic<V>(mutationFn: (variables: V) => Promise<void>, patch: (variables: V) => void) {
    return {
      mutationFn,
      onMutate: async (variables: V): Promise<Snapshot> => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: ['tasks'] }),
          queryClient.cancelQueries({ queryKey: ['spaces'] }),
        ]);
        const snapshot: Snapshot = [
          ...queryClient.getQueriesData({ queryKey: ['tasks'] }),
          ...queryClient.getQueriesData({ queryKey: ['spaces'] }),
        ];
        patch(variables);
        refreshOpenCount();
        return snapshot;
      },
      onError: (error: Error, _variables: V, snapshot: Snapshot | undefined) => {
        for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
        toast.error(error.message);
      },
    };
  }

  const create = useMutation({
    ...optimistic(createTask, (input) => {
      writeFamily(buildTask(input, today), input.spaceId);
    }),
    onSuccess: (_result, { title }) => toast.success(`Created "${title}"`),
  });

  const addMany = useMutation({
    ...optimistic(createTasks, ({ spaceId: targetSpaceId, day, tasks }) => {
      for (const { subtasks, ...task } of tasks) {
        const parent = buildTask({ ...task, status: 'todo', highPriority: false, day }, today);
        writeFamily({ ...parent, subtasks: buildSubtaskTree(subtasks, parent) }, targetSpaceId);
      }
    }),
    onSuccess: (_result, { tasks }) => toast.success(`Created ${describeTaskList(tasks)}`),
  });

  const addSubtask = useMutation({
    ...optimistic(createSubtask, ({ parentId, input }) => {
      changeFamily(parentId, (family) => withSubtask(family, buildSubtask(input, findTask(family, parentId) as Task), today));
    }),
    onSuccess: (_result, { input }) => toast.success(`Created "${input.title}"`),
  });

  const addSubtasks = useMutation({
    ...optimistic(createSubtasks, ({ parentId, subtasks }) => {
      changeFamily(parentId, (family) =>
        buildSubtaskTree(subtasks, findTask(family, parentId) as Task).reduce<Task>(
          (next, subtask) => withSubtask(next, subtask, today),
          family,
        ),
      );
    }),
    onSuccess: (_result, { subtasks }) => toast.success(`Created ${countOf(totalInList(subtasks), 'subtask')}`),
  });

  const update = useMutation(
    optimistic(updateTask, ({ id, input }: { id: string; input: TaskChanges }) => {
      const { day, ...fields } = input;
      changeFamily(id, (family) => {
        const changed = withFields(family, id, fields);
        return day ? withDay(changed, day, today) : changed;
      });
    }),
  );

  const setFinished = useMutation(
    optimistic(
      ({ id, finished, status }: { id: string; finished: boolean; status?: TaskStatus }) =>
        setTaskFinished(id, finished, today, status),
      ({ id, finished, status }) =>
        changeFamily(id, (family) => {
          const changed = withFinished(family, id, finished, today);
          return status ? withFields(changed, id, { status }) : changed;
        }),
    ),
  );

  const copy = useMutation({
    ...optimistic(
      ({ id, targetSpaceId, newIds }: CopyVariables) => copyTask(id, today, targetSpaceId, newIds),
      ({ id, targetSpaceId, newIds }) => {
        const family = familyOf(id);
        if (!family || !newIds) return;
        const target = targetSpaceId ?? spaceId;
        writeFamily(buildCopy(family, newIds, target === spaceId, today), target);
      },
    ),
    onSuccess: (_result, { targetSpaceId }) => {
      if (targetSpaceId) void queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
  });

  const reorder = useMutation(
    optimistic(reorderTasks, (ids: string[]) => {
      for (const [key, tasks] of taskCaches()) {
        if (tasks) queryClient.setQueryData(key, applyOrder(tasks, ids));
      }
    }),
  );

  const remove = useMutation({
    ...optimistic(
      (id: string) => deleteTask(id, today),
      (id) => {
        const family = familyOf(id);
        if (family && family.id !== id) writeFamily(withoutSubtask(family, id, today));
        else dropTask(id);
      },
    ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });

  const removeMany = useMutation({
    ...optimistic(deleteTasks, (ids: string[]) => ids.forEach(dropTask)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });

  return {
    create: {
      mutateAsync: (input: TaskFields & { day: string }) =>
        create.mutateAsync({ ...input, id: crypto.randomUUID(), spaceId }),
    },
    createMany: {
      mutateAsync: ({ day, list }: { day: string; list: PastedTask[] }) =>
        addMany.mutateAsync({
          spaceId,
          day,
          tasks: withNewIds(list),
        }),
    },
    createSubtask: {
      mutateAsync: ({ parentId, input }: { parentId: string; input: TaskFields }) =>
        addSubtask.mutateAsync({ parentId, input: { ...input, id: crypto.randomUUID() } }),
    },
    createManySubtasks: {
      mutateAsync: ({ parentId, list }: { parentId: string; list: PastedTask[] }) =>
        addSubtasks.mutateAsync({ parentId, subtasks: withNewIds(list) }),
    },
    update,
    setFinished,
    copy: {
      mutate: (variables: CopyVariables, options?: { onSuccess?: () => void }) => {
        const family = familyOf(variables.id);
        const newIds =
          family && Object.fromEntries(allInTree(family).map((task) => [task.id, crypto.randomUUID()]));
        copy.mutate({ ...variables, newIds }, options);
      },
    },
    reorder,
    remove,
    removeMany,
  };
}
