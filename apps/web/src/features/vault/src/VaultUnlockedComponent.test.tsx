import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { VaultUnlockedComponent } from './VaultUnlockedComponent';
import type { ItemContent, VaultItem } from './vault-types';

const state = vi.hoisted(() => ({
  items: undefined as unknown,
  save: vi.fn(),
  remove: vi.fn(),
  lock: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../hooks/useVaultItems', () => ({
  useVaultItems: () => ({ items: state.items, records: [], isError: false, save: state.save, remove: state.remove }),
}));
vi.mock('../hooks/useVaultSession', () => ({ useVaultSession: () => ({ key: {}, unlock: vi.fn(), lock: state.lock }) }));
vi.mock('sonner', () => ({ toast: { success: state.toastSuccess, error: vi.fn() } }));
vi.mock('./VaultOptionsMenuComponent', () => ({ VaultOptionsMenuComponent: () => null }));

const card: ItemContent = {
  version: 1,
  type: 'card',
  name: 'Travel card',
  notes: 'Use abroad',
  fields: [
    { label: 'Name on card', value: 'Sample Person', secret: false },
    { label: 'Card number', value: '4242 4242 4242 4242', secret: true },
    { label: 'CVV', value: '987', secret: true },
  ],
};
const login: ItemContent = {
  version: 1,
  type: 'login',
  name: 'Work email',
  notes: '',
  fields: [{ label: 'Password', value: 'hunter2hunter2', secret: true }],
};
const item = (id: string, content: ItemContent | null): VaultItem => ({ id, updatedAt: '2026-11-09T12:00:00.000Z', content });
const renderVault = (canEdit = true) => render(<VaultUnlockedComponent spaceId="s1" spaceTitle="Safe" canEdit={canEdit} isOwner={canEdit} />);
const row = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  state.items = [item('a', card), item('b', login)];
  state.save.mockResolvedValue('new-id');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

it('lists items with their summary', () => {
  renderVault();
  expect(row(/Travel card/)).toHaveTextContent('Card · Ending 4242');
  expect(screen.getByRole('heading', { name: 'Safe' })).toBeInTheDocument();
  expect(screen.getByText('2 items')).toBeInTheDocument();
});

it('narrows the list by search', async () => {
  renderVault();
  await userEvent.type(screen.getByRole('textbox', { name: 'Search the vault' }), 'work');
  expect(screen.queryByRole('button', { name: /Travel card/ })).not.toBeInTheDocument();
  expect(row(/Work email/)).toBeInTheDocument();
});

it('says when nothing matches a search', async () => {
  renderVault();
  await userEvent.type(screen.getByRole('textbox', { name: 'Search the vault' }), 'zzz');
  expect(screen.getByText('No items match.')).toBeInTheDocument();
});

it('masks secret values until shown, one at a time', async () => {
  renderVault();
  expect(screen.queryByText('4242 4242 4242 4242')).not.toBeInTheDocument();
  expect(screen.getByText('Sample Person')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show Card number' }));
  expect(screen.getByText('4242 4242 4242 4242')).toBeInTheDocument();
  expect(screen.queryByText('987')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Hide Card number' }));
  expect(screen.queryByText('4242 4242 4242 4242')).not.toBeInTheDocument();
});

it('hides revealed values when another item is opened', async () => {
  renderVault();
  await userEvent.click(screen.getByRole('button', { name: 'Show Card number' }));
  await userEvent.click(row(/Work email/));
  await userEvent.click(row(/Travel card/));
  expect(screen.queryByText('4242 4242 4242 4242')).not.toBeInTheDocument();
});

it('shows "Can\'t read this item" with Delete for an unreadable item', async () => {
  state.items = [item('bad', null)];
  renderVault();
  expect(screen.getAllByText("Can't read this item").length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  expect(state.remove).toHaveBeenCalledWith('bad');
});

it('confirms before deleting', async () => {
  renderVault();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(state.remove).not.toHaveBeenCalled();
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
  expect(state.remove).toHaveBeenCalledWith('a');
});

it('uses a generic toast when copying', async () => {
  renderVault();
  await userEvent.click(screen.getByRole('button', { name: 'Copy Card number' }));
  await waitFor(() => expect(state.toastSuccess).toHaveBeenCalledWith('Copied. Clipboard clears in 30 seconds.'));
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('4242 4242 4242 4242');
});

it('shows an empty state with Add item when there are no items', async () => {
  state.items = [];
  renderVault();
  expect(screen.getByText('This vault is empty')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Add item' })).toHaveLength(2);
});

it('saves a new item with a generic toast', async () => {
  renderVault();
  await userEvent.click(screen.getAllByRole('button', { name: 'Add item' })[0]);
  await userEvent.type(screen.getByLabelText('Name'), 'Passport');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(null, expect.objectContaining({ name: 'Passport' })));
  await waitFor(() => expect(state.toastSuccess).toHaveBeenCalledWith('Item saved'));
});

it('edits the open item under its own id', async () => {
  renderVault();
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.type(screen.getByLabelText('Name'), ' new');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith('a', expect.objectContaining({ name: 'Travel card new' })));
});

it('locks on request', async () => {
  renderVault();
  await userEvent.click(screen.getByRole('button', { name: 'Lock now' }));
  expect(state.lock).toHaveBeenCalled();
});

it('shows a viewer the items but nothing that changes them', async () => {
  renderVault(false);
  expect(await screen.findByRole('heading', { name: 'Travel card' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add item' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
});
