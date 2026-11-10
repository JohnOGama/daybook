import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { VaultItemFormComponent } from './VaultItemFormComponent';
import { VaultPageComponent } from './VaultPageComponent';
import type { ItemContent } from './vault-types';

const state = vi.hoisted(() => ({ session: { key: {} as object | null, unlock: vi.fn(), lock: vi.fn() } }));

vi.mock('../hooks/useVault', () => ({ useVault: () => ({ data: { salt: 's' }, isPending: false, isError: false }) }));
vi.mock('../hooks/useVaultSession', () => ({ useVaultSession: () => state.session }));
vi.mock('../hooks/useVaultItems', () => ({
  useVaultItems: () => ({ items: [], records: [], isError: false, save: vi.fn(), remove: vi.fn() }),
}));
vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1', title: 'Safe' }) }));
vi.mock('./VaultOptionsMenuComponent', () => ({ VaultOptionsMenuComponent: () => null }));

const onSave = vi.fn();
const onCancel = vi.fn();
const renderForm = (initial?: ItemContent) =>
  render(<VaultItemFormComponent initial={initial} onSave={onSave} onCancel={onCancel} />);
const clickSave = () => userEvent.click(screen.getByRole('button', { name: 'Save' }));

beforeEach(() => {
  vi.clearAllMocks();
  onSave.mockResolvedValue(undefined);
  state.session.key = {};
});

it('changes fields with the type', async () => {
  renderForm();
  expect(screen.getByLabelText('Card number')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(screen.queryByLabelText('Card number')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Username')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
});

it('offers no preset fields for Other', async () => {
  renderForm();
  await userEvent.click(screen.getByRole('button', { name: 'Other' }));
  expect(screen.queryByLabelText('Card number')).not.toBeInTheDocument();
});

it('needs a name', async () => {
  renderForm();
  await clickSave();
  expect(screen.getByRole('alert')).toHaveTextContent('Give this item a name.');
  expect(onSave).not.toHaveBeenCalled();
});

it('requires only a name and drops blank fields', async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText('Name'), 'Travel');
  await clickSave();
  expect(onSave).toHaveBeenCalledWith({ version: 1, type: 'card', name: 'Travel', fields: [], notes: '' });
});

it('saves preset fields with their secret flags', async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText('Name'), 'Travel');
  await userEvent.type(screen.getByLabelText('Card number'), '4242');
  await userEvent.type(screen.getByLabelText('Expiry'), '08/29');
  await clickSave();
  expect(onSave.mock.calls[0][0].fields).toEqual([
    { label: 'Card number', value: '4242', secret: true },
    { label: 'Expiry', value: '08/29', secret: false },
  ]);
});

it('hides a custom field by default and can show it', async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText('Name'), 'Travel');
  await userEvent.click(screen.getByRole('button', { name: 'Add field' }));
  const value = screen.getByRole('group', { name: 'Custom field 1' }).querySelector('input[aria-label="Field value"]');
  expect(value).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getByRole('button', { name: 'Show this value' }));
  expect(value).toHaveAttribute('type', 'text');
  await userEvent.type(screen.getByLabelText('Field name'), 'Support line');
  await userEvent.type(value as Element, '0800');
  await clickSave();
  expect(onSave.mock.calls[0][0].fields).toEqual([{ label: 'Support line', value: '0800', secret: false }]);
});

it('keeps a custom field secret unless shown', async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText('Name'), 'Travel');
  await userEvent.click(screen.getByRole('button', { name: 'Add field' }));
  await userEvent.type(screen.getByLabelText('Field name'), 'PIN');
  await userEvent.type(screen.getByLabelText('Field value'), '1234');
  await clickSave();
  expect(onSave.mock.calls[0][0].fields).toEqual([{ label: 'PIN', value: '1234', secret: true }]);
});

it('fills the form when editing and keeps extra fields', () => {
  renderForm({
    version: 1,
    type: 'login',
    name: 'Mail',
    notes: 'note',
    fields: [
      { label: 'Username', value: 'sam', secret: false },
      { label: 'Backup code', value: '111', secret: true },
    ],
  });
  expect(screen.getByLabelText('Name')).toHaveValue('Mail');
  expect(screen.getByLabelText('Username')).toHaveValue('sam');
  expect(screen.getByLabelText('Field name')).toHaveValue('Backup code');
  expect(screen.getByLabelText('Notes')).toHaveValue('note');
  expect(screen.queryByRole('button', { name: 'Card' })).not.toBeInTheDocument();
});

it('stays open when saving fails', async () => {
  onSave.mockRejectedValue(new Error('nope'));
  renderForm();
  await userEvent.type(screen.getByLabelText('Name'), 'Travel');
  await clickSave();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  expect(screen.getByLabelText('Name')).toHaveValue('Travel');
});

it('clears the form without crashing when the vault locks', async () => {
  const page = (
    <QueryClientProvider client={new QueryClient()}>
      <VaultPageComponent />
    </QueryClientProvider>
  );
  const { rerender } = render(page);
  await userEvent.click(screen.getAllByRole('button', { name: 'Add item' })[0]);
  await userEvent.type(screen.getByLabelText('Card number'), 'typed-secret');

  state.session.key = null;
  rerender(
    <QueryClientProvider client={new QueryClient()}>
      <VaultPageComponent />
    </QueryClientProvider>,
  );

  expect(screen.getByRole('heading', { name: 'Safe is locked' })).toBeInTheDocument();
  expect(screen.queryByDisplayValue('typed-secret')).not.toBeInTheDocument();
});
