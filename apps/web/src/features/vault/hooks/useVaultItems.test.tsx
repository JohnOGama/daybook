import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createVault, encryptJson } from '../src/vault-crypto';
import type { ItemContent, VaultRecord } from '../src/vault-types';
import { useVaultItems } from './useVaultItems';
import { VaultSessionContext } from './useVaultSession';

// Real key derivation is slow on purpose, and slower still while the whole suite runs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const api = vi.hoisted(() => ({ fetchItems: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(), fetchSpaceKey: vi.fn(async () => null) }));
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('../src/vault-api', () => api);
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const queryKey = ['vault-items', 's1'];
const content = (name: string): ItemContent => ({ version: 1, type: 'other', name, fields: [], notes: '' });
const never = () => new Promise<void>(() => {});

let vaultKey: CryptoKey;
let currentKey: CryptoKey | null;
let client: QueryClient;

const record = async (id: string, name: string): Promise<VaultRecord> => ({
  id,
  updatedAt: '2026-11-10T00:00:00.000Z',
  ...(await encryptJson(vaultKey, id, content(name))),
});

function setup() {
  return renderHook(() => useVaultItems('s1'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <VaultSessionContext.Provider value={{ key: currentKey, unlock: vi.fn(), lock: vi.fn() }}>
          {children}
        </VaultSessionContext.Provider>
      </QueryClientProvider>
    ),
  });
}

beforeAll(async () => {
  ({ key: vaultKey } = await createVault('hook test passcode'));
});

beforeEach(() => {
  vi.clearAllMocks();
  currentKey = vaultKey;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.fetchItems.mockResolvedValue([]);
  api.createItem.mockResolvedValue(undefined);
  api.updateItem.mockResolvedValue(undefined);
  api.deleteItem.mockResolvedValue(undefined);
});

it('does not load anything while locked', () => {
  currentKey = null;
  const { result } = setup();
  expect(result.current.items).toBeUndefined();
  expect(api.fetchItems).not.toHaveBeenCalled();
});

it('decrypts what the server returns', async () => {
  api.fetchItems.mockResolvedValue([await record('a', 'Passport')]);
  const { result } = setup();
  await waitFor(() => expect(result.current.items?.[0].content?.name).toBe('Passport'));
});

it('keeps only ciphertext in the query cache', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.items).toEqual([]));
  await act(() => result.current.save(null, content('Travel card')));
  expect(client.getQueryData<VaultRecord[]>(queryKey)).toHaveLength(1);
  expect(JSON.stringify(client.getQueryData(queryKey))).not.toContain('Travel card');
});

it('shows a saved item at once and sends the same id', async () => {
  api.createItem.mockReturnValue(never());
  const { result } = setup();
  await waitFor(() => expect(result.current.items).toEqual([]));
  act(() => {
    void result.current.save(null, content('New'));
  });
  await waitFor(() => expect(result.current.items?.[0].content?.name).toBe('New'));
  expect(api.createItem.mock.calls[0][0]).toMatchObject({ id: result.current.items?.[0].id, spaceId: 's1' });
});

it('updates an existing item in place of the old one', async () => {
  api.fetchItems.mockResolvedValue([await record('a', 'Old')]);
  const { result } = setup();
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  await act(() => result.current.save('a', content('Renamed')));
  await waitFor(() => expect(result.current.items?.[0].content?.name).toBe('Renamed'));
  expect(result.current.items).toHaveLength(1);
  expect(api.updateItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
});

it('restores the cache and reports when the server refuses', async () => {
  api.createItem.mockRejectedValue(new Error('nope'));
  const { result } = setup();
  await waitFor(() => expect(result.current.items).toEqual([]));
  await act(() => result.current.save(null, content('Lost')).catch(() => {}));
  expect(client.getQueryData(queryKey)).toEqual([]);
  expect(toastError).toHaveBeenCalledWith('nope');
});

it('removes an item at once and brings it back if refused', async () => {
  api.fetchItems.mockResolvedValue([await record('a', 'A')]);
  api.deleteItem.mockRejectedValue(new Error('nope'));
  const { result } = setup();
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  act(() => result.current.remove('a'));
  await waitFor(() => expect(toastError).toHaveBeenCalledWith('nope'));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
});

it('marks one unreadable item and still shows the rest', async () => {
  const good = await record('ok', 'Readable');
  const moved = { ...(await record('elsewhere', 'Moved')), id: 'bad' };
  api.fetchItems.mockResolvedValue([moved, good]);
  const { result } = setup();
  await waitFor(() => expect(result.current.items).toHaveLength(2));
  expect(result.current.items?.[0]).toEqual({ id: 'bad', updatedAt: moved.updatedAt, content: null });
  expect(result.current.items?.[1].content?.name).toBe('Readable');
});

it('drops decrypted items when the session locks', async () => {
  api.fetchItems.mockResolvedValue([await record('a', 'A')]);
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  currentKey = null;
  rerender();
  expect(result.current.items).toBeUndefined();
});
