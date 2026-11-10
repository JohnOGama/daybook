import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { VaultImportComponent } from './VaultImportComponent';
import { buildBackup } from './vault-backup';
import { createVault, decryptJson, encryptJson } from './vault-crypto';
import type { ItemContent } from './vault-types';

// Real key derivation is slow on purpose, and slower still while the whole suite runs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const state = vi.hoisted(() => ({
  importItems: vi.fn(),
  session: { key: null as CryptoKey | null, unlock: vi.fn(), lock: vi.fn() },
  toastSuccess: vi.fn(),
}));

vi.mock('./vault-api', () => ({ importItems: state.importItems }));
vi.mock('../hooks/useVaultSession', () => ({ useVaultSession: () => state.session }));
vi.mock('sonner', () => ({ toast: { success: state.toastSuccess, error: vi.fn() } }));

const PASS = 'backup passcode 12';
const content: ItemContent = {
  version: 1,
  type: 'card',
  name: 'Old savings card',
  notes: '',
  fields: [{ label: 'Card number', value: '4111 1111 1111 1111', secret: true }],
};

let backupText: string;
let otherKey: CryptoKey;
const onDone = vi.fn();

function fileOf(text: string, size?: number) {
  const file = new File([size ? new Uint8Array(size) : text], 'backup.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  return file;
}

function renderImport() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VaultImportComponent spaceId="s1" onDone={onDone} />
    </QueryClientProvider>,
  );
}

async function open(text = backupText, secret = PASS, size?: number) {
  renderImport();
  await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(text, size));
  await userEvent.type(screen.getByLabelText(/Passcode or recovery key/), secret);
  await userEvent.click(screen.getByRole('button', { name: 'Open backup' }));
}

beforeAll(async () => {
  const source = await createVault(PASS);
  const id = crypto.randomUUID();
  const record = { id, updatedAt: '', ...(await encryptJson(source.key, id, content)) };
  backupText = JSON.stringify(buildBackup(source.material, [record], '2026-11-10T00:00:00.000Z'));
  otherKey = (await createVault('another account pass')).key;
});

beforeEach(() => {
  vi.clearAllMocks();
  state.session.key = otherKey;
  state.importItems.mockResolvedValue(undefined);
});

it('shows items masked before anything is saved', async () => {
  await open();
  expect(await screen.findByText('Old savings card')).toBeInTheDocument();
  expect(screen.queryByText('4111 1111 1111 1111')).not.toBeInTheDocument();
  expect(state.importItems).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Show Card number' }));
  expect(screen.getByText('4111 1111 1111 1111')).toBeInTheDocument();
});

it('imports all items after confirming, under new ids and this vault key', async () => {
  await open();
  await userEvent.click(await screen.findByRole('button', { name: 'Import 1 item' }));
  await waitFor(() => expect(state.importItems).toHaveBeenCalledTimes(1));
  const { spaceId, items } = state.importItems.mock.calls[0][0];
  expect(spaceId).toBe('s1');
  await expect(decryptJson(otherKey, items[0].id, items[0])).resolves.toMatchObject({ name: 'Old savings card' });
  expect(backupText).not.toContain(items[0].id);
  await waitFor(() => expect(state.toastSuccess).toHaveBeenCalledWith('Imported 1 item'));
  expect(onDone).toHaveBeenCalled();
});

it('leaves the vault untouched on Cancel', async () => {
  await open();
  await screen.findByText('Old savings card');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(state.importItems).not.toHaveBeenCalled();
  expect(onDone).toHaveBeenCalled();
});

it('shows an error for a wrong secret', async () => {
  await open(backupText, 'not the right passcode');
  expect(await screen.findByRole('alert')).toHaveTextContent('That passcode or recovery key is not right.');
  expect(state.importItems).not.toHaveBeenCalled();
});

it('shows an error for an invalid file and imports nothing', async () => {
  await open('not a backup at all');
  expect(await screen.findByRole('alert')).toHaveTextContent('not a valid Daybook vault backup');
  expect(state.importItems).not.toHaveBeenCalled();
});

it('refuses a file over 8 MB with a clear message', async () => {
  await open(backupText, PASS, 8 * 1024 * 1024 + 1);
  expect(await screen.findByRole('alert')).toHaveTextContent('too large');
  expect(state.importItems).not.toHaveBeenCalled();
});

it('reports a server failure and stays open', async () => {
  state.importItems.mockRejectedValue(new Error('That backup could not be imported. Nothing was added.'));
  await open();
  await userEvent.click(await screen.findByRole('button', { name: 'Import 1 item' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nothing was added.');
  expect(onDone).not.toHaveBeenCalled();
});
