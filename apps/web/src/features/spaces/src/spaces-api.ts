import type { NewSpaceInput, Share, ShareRole, Space } from './space-types';

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

export const setSpaceCarryOver = ({ id, carryOver }: { id: string; carryOver: boolean }) =>
  send(`/api/spaces/${id}/carry-over`, 'PUT', 'That setting could not be saved. Please try again.', { carryOver });

export const setSpaceParent = ({ id, parentId }: { id: string; parentId: string | null }) =>
  send(`/api/spaces/${id}/parent`, 'PUT', 'That space could not be moved. Please try again.', { parentId });

export const reorderSpaces =(ids: string[]) =>
  send('/api/spaces/order', 'PUT', 'That order could not be saved. Please try again.', { ids });

export const duplicateSpace =({ source, id }: { source: Space; id: string }) =>
  send(`/api/spaces/${source.id}/duplicate`, 'POST', 'That space could not be duplicated. Please try again.', { id });

export const deleteSpace = (id: string) =>
  send(`/api/spaces/${id}`, 'DELETE', 'That space could not be deleted. Please try again.');

export async function fetchShares(spaceId: string): Promise<Share[]> {
  const response = await fetch(`/api/spaces/${spaceId}/shares`);
  if (!response.ok) throw new Error('Could not load who this is shared with');
  return response.json();
}

export async function addShare({ spaceId, ...share }: Share & { spaceId: string }): Promise<void> {
  const response = await fetch(`/api/spaces/${spaceId}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(share),
  });
  if (response.ok) return;
  const { message } = response.status === 400 ? await response.json().catch(() => ({})) : {};
  throw new Error(typeof message === 'string' ? message : 'That invite could not be sent. Please try again.');
}

export const setShareRole = ({ spaceId, shareId, role }: { spaceId: string; shareId: string; role: ShareRole }) =>
  send(`/api/spaces/${spaceId}/shares/${shareId}`, 'PATCH', 'That role could not be saved. Please try again.', { role });

export const removeShare = ({ spaceId, shareId }: { spaceId: string; shareId: string }) =>
  send(`/api/spaces/${spaceId}/shares/${shareId}`, 'DELETE', 'That person could not be removed. Please try again.');

export const leaveShare = (spaceId: string) =>
  send(`/api/spaces/${spaceId}/shares/me`, 'DELETE', 'That space could not be left. Please try again.');
