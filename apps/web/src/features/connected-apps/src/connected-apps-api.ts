export type ConnectedApp = { id: string; name: string; connectedAt: string; scopes: string[] };

export async function fetchConnectedApps(): Promise<ConnectedApp[]> {
  const response = await fetch('/api/connected-apps');
  if (!response.ok) throw new Error('Could not load your connected apps');
  return response.json();
}

export async function disconnectApp(id: string): Promise<void> {
  const response = await fetch(`/api/connected-apps/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Could not disconnect');
}
