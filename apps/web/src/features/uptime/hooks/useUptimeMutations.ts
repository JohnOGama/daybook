'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addMonitor, checkMonitor, deleteMonitor, updateMonitor } from '../src/uptime-api';
import type { MonitorChanges, MonitorDetail, MonitorInput, MonitorRow, UptimeView } from '../src/uptime-types';
import { useUptimeSpaceId } from './useUptime';

// Adding, editing and checking wait for the server, because only it knows whether the site answers.
// Each puts the row it returns into the page and refreshes the sidebar dot.
export function useUptimeMutations() {
  const queryClient = useQueryClient();
  const spaceId = useUptimeSpaceId() as string;
  const key = ['uptime', spaceId];

  const writeView = (change: (view: UptimeView) => UptimeView) => queryClient.setQueryData<UptimeView>(key, (view) => view && change(view));
  const putRow = (row: MonitorRow) => {
    writeView((view) => {
      const known = view.monitors.some(({ id }) => id === row.id);
      return { ...view, monitors: known ? view.monitors.map((site) => (site.id === row.id ? row : site)) : [...view.monitors, row] };
    });
    // The open drawer shows the new status at once; the refetch then brings its uptime and incidents up to date.
    queryClient.setQueryData<MonitorDetail>(['uptime-monitor', row.id], (detail) => detail && { ...detail, ...row });
    void queryClient.invalidateQueries({ queryKey: ['uptime-monitor', row.id] });
    void queryClient.invalidateQueries({ queryKey: ['spaces'] });
  };

  const add = useMutation({ mutationFn: (input: MonitorInput) => addMonitor(spaceId, input), onSuccess: putRow });

  const update = useMutation({ mutationFn: ({ id, changes }: { id: string; changes: MonitorChanges }) => updateMonitor(id, changes), onSuccess: putRow });

  const check = useMutation({
    mutationFn: checkMonitor,
    onSuccess: putRow,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: deleteMonitor,
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<UptimeView>(key);
      writeView((view) => ({ ...view, monitors: view.monitors.filter((site) => site.id !== id) }));
      return previous;
    },
    onError: (error: Error, _id, previous) => {
      queryClient.setQueryData(key, previous);
      toast.error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });

  return { add, update, check, remove };
}
