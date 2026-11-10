import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVault, decryptJson, encryptJson } from '@/features/vault/src/vault-crypto';
import { TrashPageComponent } from './TrashPageComponent';

// Real key derivation is slow on purpose, and slower still while the whole suite runs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const { useTrash, restore } = vi.hoisted(() => ({ useTrash: vi.fn(), restore: vi.fn() }));

vi.mock('../hooks/useTrash', () => ({ useTrash }));
vi.mock('../hooks/useRestoreItem', () => ({ useRestoreItem: () => ({ mutate: restore }) }));
vi.mock('@/features/vault', () => ({
  useVaultSession: () => session,
  decryptJson: (...args: Parameters<typeof decryptJson>) => decryptJson(...args),
}));

const session = { key: null as CryptoKey | null };

const vaultRow = async (key: CryptoKey, name: string) => ({
  id: 'v1',
  type: 'vault-item',
  title: 'Encrypted item',
  location: 'Safe',
  deletedAt: '2026-11-09T10:00:00.000Z',
  payload: await encryptJson(key, 'v1', { version: 1, type: 'other', name, fields: [], notes: '' }),
});

describe('vault items', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    ({ key } = await createVault('trash test passcode'));
  });

  beforeEach(() => {
    session.key = null;
  });

  it('shows "Encrypted item" while the vault is locked, and can restore it', async () => {
    const row = await vaultRow(key, 'Passport');
    useTrash.mockReturnValue({ data: [row], isPending: false, isError: false });
    render(<TrashPageComponent />);
    expect(screen.getByText('Encrypted item')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Restore Encrypted item' }));
    expect(restore).toHaveBeenCalledWith(row);
  });

  it('shows the real name once unlocked', async () => {
    session.key = key;
    useTrash.mockReturnValue({ data: [await vaultRow(key, 'Passport')], isPending: false, isError: false });
    render(<TrashPageComponent />);
    expect(await screen.findByText('Passport')).toBeInTheDocument();
  });

  it('falls back to "Encrypted item" when an item cannot be read', async () => {
    session.key = (await createVault('a different passcode')).key;
    useTrash.mockReturnValue({ data: [await vaultRow(key, 'Passport')], isPending: false, isError: false });
    render(<TrashPageComponent />);
    await waitFor(() => expect(screen.getByText('Encrypted item')).toBeInTheDocument());
    expect(screen.queryByText('Passport')).not.toBeInTheDocument();
  });

  it('passes the server item to restore, so the toast never holds a decrypted name', async () => {
    session.key = key;
    useTrash.mockReturnValue({ data: [await vaultRow(key, 'Passport')], isPending: false, isError: false });
    render(<TrashPageComponent />);
    await screen.findByText('Passport');
    await userEvent.click(screen.getByRole('button', { name: /^Restore/ }));
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ title: 'Encrypted item' }));
  });
});

const items = [
  { id: 't1', type: 'task', title: 'Buy milk', location: 'Home', deletedAt: '2026-11-09T10:00:00.000Z' },
  { id: 'f1', type: 'folder', title: 'Team', location: null, deletedAt: '2026-11-08T10:00:00.000Z' },
];

beforeEach(() => vi.clearAllMocks());

it('lists each deleted item and where it came from', () => {
  useTrash.mockReturnValue({ data: items, isPending: false, isError: false });
  render(<TrashPageComponent />);
  expect(screen.getByText('Buy milk')).toBeInTheDocument();
  expect(screen.getByText('Home')).toBeInTheDocument();
  expect(screen.getByText('Team')).toBeInTheDocument();
});

it('Restore restores that item', async () => {
  useTrash.mockReturnValue({ data: items, isPending: false, isError: false });
  render(<TrashPageComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Restore Buy milk' }));
  expect(restore).toHaveBeenCalledWith(items[0]);
});

it('says when the trash is empty', () => {
  useTrash.mockReturnValue({ data: [], isPending: false, isError: false });
  render(<TrashPageComponent />);
  expect(screen.getByRole('heading', { name: 'Trash is empty' })).toBeInTheDocument();
});

it('shows a skeleton instead of sample rows while loading', () => {
  useTrash.mockReturnValue({ data: undefined, isPending: true, isError: false });
  const { container } = render(<TrashPageComponent />);
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Trash is empty' })).not.toBeInTheDocument();
});

it('reports a load failure', () => {
  useTrash.mockReturnValue({ data: undefined, isPending: false, isError: true });
  render(<TrashPageComponent />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
