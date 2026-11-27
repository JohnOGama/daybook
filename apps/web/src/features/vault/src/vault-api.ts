import type { PasscodeWrap, RecoveryWrap, SpaceKeyWrap, VaultMaterial } from './vault-crypto';
import type { VaultRecord } from './vault-types';

export type NewVaultItem = Omit<VaultRecord, 'updatedAt'>;

function send(path: string, method: string, body?: unknown) {
  return fetch(`/api/vault${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function sendOrThrow(path: string, method: string, body: unknown, message: string): Promise<void> {
  const response = await send(path, method, body);
  if (!response.ok) throw new Error(message);
}

export async function fetchVault(): Promise<VaultMaterial | null> {
  const response = await send('', 'GET');
  if (!response.ok) throw new Error('Could not load your vault');
  return (await response.json()).vault;
}

export async function saveNewVault(material: VaultMaterial): Promise<void> {
  const response = await send('', 'POST', material);
  if (response.status === 409) throw new Error('This vault was already created in another tab. Reload to unlock it.');
  if (!response.ok) throw new Error('Your vault could not be created. Please try again.');
}

export const savePasscodeWrap = (wrap: PasscodeWrap) =>
  sendOrThrow('/passcode', 'PUT', wrap, 'Your new passcode could not be saved. Please try again.');

export const saveRecoveryWrap = (wrap: RecoveryWrap) =>
  sendOrThrow('/recovery', 'PUT', wrap, 'Your new recovery key could not be saved. Please try again.');

export const eraseVault = () => sendOrThrow('', 'DELETE', undefined, 'Your vault could not be erased. Please try again.');

// `includeDeleted` (owner only) adds trashed items, which setting a sharing passcode has to re-encrypt too.
export async function fetchItems(spaceId: string, includeDeleted = false): Promise<VaultRecord[]> {
  const query = new URLSearchParams(includeDeleted ? { spaceId, includeDeleted: 'true' } : { spaceId });
  const response = await send(`/items?${query}`, 'GET');
  if (!response.ok) throw new Error('Could not load this vault');
  return response.json();
}

export const createItem = (item: NewVaultItem & { spaceId: string }) =>
  sendOrThrow('/items', 'POST', item, 'That item could not be saved. Please try again.');

export const updateItem = ({ id, iv, ciphertext }: NewVaultItem) =>
  sendOrThrow(`/items/${id}`, 'PUT', { iv, ciphertext }, 'That item could not be saved. Please try again.');

export const deleteItem = (id: string) =>
  sendOrThrow(`/items/${id}`, 'DELETE', undefined, 'That item could not be deleted. Please try again.');

export const importItems = (input: { spaceId: string; items: NewVaultItem[] }) =>
  sendOrThrow('/items/import', 'POST', input, 'That backup could not be imported. Nothing was added.');

export async function fetchSpaceKey(spaceId: string): Promise<SpaceKeyWrap | null> {
  const response = await send(`/spaces/${spaceId}/key`, 'GET');
  if (!response.ok) throw new Error('Could not load this vault');
  return (await response.json()).key;
}

export async function saveSpaceKey(spaceId: string, body: SpaceKeyWrap & { items?: NewVaultItem[] }): Promise<void> {
  const response = await send(`/spaces/${spaceId}/key`, 'PUT', body);
  if (response.ok) return;
  const { message } = response.status === 409 ? await response.json().catch(() => ({})) : {};
  throw new Error(typeof message === 'string' ? message : 'The sharing passcode could not be saved. Please try again.');
}
