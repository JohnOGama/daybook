'use client';

import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { moveToGroup, removeGroupItems } from '../src/space-cache';
import { createSpaceGroup, deleteSpaceGroup, fetchSpaceGroups, renameSpaceGroup, reorderSpaceGroups, setSpaceGroup } from '../src/spaces-api';
import type { Space, SpaceGroup } from '../src/space-types';
import { useSpaceOptimism } from './useSpaceOptimism';

const KEY = ['space-groups'];

export function useSpaceGroups() {
  return useQuery({ queryKey: KEY, queryFn: fetchSpaceGroups });
}

type Snapshot = { groups?: SpaceGroup[]; spaces: [QueryKey, Space[] | undefined][] };

// Patches the groups (and, for a delete, the spaces) at once, and puts both back if the server says no.
function useGroupMutation<V>(mutationFn: (variables: V) => Promise<void>, patch: (groups: SpaceGroup[], variables: V) => SpaceGroup[], patchSpaces?: (spaces: Space[], variables: V, groups: SpaceGroup[]) => Space[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: V): Promise<Snapshot> => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const groups = queryClient.getQueryData<SpaceGroup[]>(KEY);
      const spaces = queryClient.getQueriesData<Space[]>({ queryKey: ['spaces'] });
      if (groups) queryClient.setQueryData(KEY, patch(groups, variables));
      if (patchSpaces && groups) queryClient.setQueriesData<Space[]>({ queryKey: ['spaces'] }, (list) => list && patchSpaces(list, variables, groups));
      return { groups, spaces };
    },
    onError: (error: Error, _variables: V, snapshot?: Snapshot) => {
      if (snapshot?.groups) queryClient.setQueryData(KEY, snapshot.groups);
      for (const [key, data] of snapshot?.spaces ?? []) queryClient.setQueryData(key, data);
      toast.error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });
}

export function useCreateSpaceGroup() {
  const mutation = useGroupMutation(createSpaceGroup, (groups, group: SpaceGroup) => [...groups, group]);
  return (title: string) => mutation.mutate({ id: crypto.randomUUID(), title: title.trim() });
}

export const useRenameSpaceGroup = () =>
  useGroupMutation(renameSpaceGroup, (groups, { id, title }: SpaceGroup) => groups.map((group) => (group.id === id ? { ...group, title } : group)));

export const useReorderSpaceGroups = () =>
  useGroupMutation(reorderSpaceGroups, (groups, ids: string[]) => ids.flatMap((id) => groups.find((group) => group.id === id) ?? []));

export const useDeleteSpaceGroup = () =>
  useGroupMutation(
    deleteSpaceGroup,
    (groups, id: string) => groups.filter((group) => group.id !== id),
    (spaces, id, groups) => removeGroupItems(spaces, id, groups),
  );

export function useMoveToGroup() {
  const optimistic = useSpaceOptimism();
  return useMutation(optimistic(setSpaceGroup, (spaces, { id, groupId, order }: { id: string; groupId: string; order?: string[] }) => moveToGroup(spaces, id, groupId, order)));
}
