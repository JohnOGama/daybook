import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { type ConnectedApp, disconnectApp, fetchConnectedApps } from '../src/connected-apps-api';

const KEY = ['connected-apps'];

export function useConnectedApps() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: fetchConnectedApps });

  // No Undo: an app's grant can't be re-created from here, it has to connect again.
  const disconnect = useMutation({
    mutationFn: (app: ConnectedApp) => disconnectApp(app.id),
    onMutate: async (app) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const before = queryClient.getQueryData<ConnectedApp[]>(KEY);
      queryClient.setQueryData<ConnectedApp[]>(KEY, (apps) => apps?.filter(({ id }) => id !== app.id));
      return { before };
    },
    onError: (_error, app, context) => {
      queryClient.setQueryData(KEY, context?.before);
      toast.error(`Could not disconnect ${app.name}`);
    },
    onSuccess: (_result, app) => toast.success(`Disconnected ${app.name}`),
  });

  return { apps: query.data, isPending: query.isPending, isError: query.isError, disconnect: disconnect.mutate };
}
