async function lockRequest(url: string, method: string, failure: string, body?: object): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.ok) return;
  const { message } = await response.json().catch(() => ({ message: undefined }));
  throw new Error(response.status < 500 && typeof message === 'string' ? message : failure);
}

export async function fetchUnlocked(id: string): Promise<boolean> {
  const response = await fetch(`/api/spaces/${id}/unlock`);
  if (!response.ok) throw new Error('Could not check this space');
  return (await response.json()).unlocked;
}

export const unlockSpace = ({ id, password }: { id: string; password: string }) =>
  lockRequest(`/api/spaces/${id}/unlock`, 'POST', 'Could not unlock this space. Please try again.', { password });

export const lockSpaceNow = (id: string) =>
  lockRequest(`/api/spaces/${id}/unlock`, 'DELETE', 'Could not lock this space. Please try again.');

export type SetPasswordInput = { id: string; password: string; currentPassword?: string };

export const setSpacePassword = ({ id, ...body }: SetPasswordInput) =>
  lockRequest(`/api/spaces/${id}/lock`, 'PUT', 'That password could not be saved. Please try again.', body);

export type RemovePasswordInput = { id: string } & ({ password: string } | { accountPassword: string });

export const removeSpacePassword = ({ id, ...proof }: RemovePasswordInput) =>
  lockRequest(`/api/spaces/${id}/lock`, 'DELETE', 'That password could not be removed. Please try again.', proof);
