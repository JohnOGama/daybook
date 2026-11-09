import type { NewSpaceInput, Space } from './space-types';

async function send(url: string, method: string, failure: string, body?: object): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(failure);
}

export async function fetchSpaces(today: string): Promise<Space[]> {
  const response = await fetch(`/api/spaces?${new URLSearchParams({ today })}`);
  if (!response.ok) throw new Error('Could not load your spaces');
  return response.json();
}

export async function createSpace(input: NewSpaceInput): Promise<Space> {
  const response = await fetch('/api/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error('That space could not be created. Please try again.');
  return response.json();
}

export const updateSpaceTitle = ({ id, title }: { id: string; title: string }) =>
  send(`/api/spaces/${id}`, 'PATCH', 'That name could not be saved. Please try again.', { title });

export const reorderSpaces = (ids: string[]) =>
  send('/api/spaces/order', 'PUT', 'That order could not be saved. Please try again.', { ids });

export const duplicateSpace =({ source, id }: { source: Space; id: string }) =>
  send(`/api/spaces/${source.id}/duplicate`, 'POST', 'That space could not be duplicated. Please try again.', { id });

export const deleteSpace = (id: string) =>
  send(`/api/spaces/${id}`, 'DELETE', 'That space could not be deleted. Please try again.');
