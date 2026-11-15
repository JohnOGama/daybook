import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpaceLockGateComponent } from './SpaceLockGateComponent';
import type { Space } from './space-types';

const { unlocked, unlock, removePassword } = vi.hoisted(() => ({
  unlocked: { current: false },
  unlock: vi.fn(),
  removePassword: vi.fn(),
}));
vi.mock('../hooks/useSpaceLock', () => ({
  useSpaceUnlocked: () => ({ data: unlocked.current, isPending: false, isError: false }),
  useSpaceLock: () => ({ unlock: { mutate: unlock }, removePassword: { mutate: removePassword } }),
}));

const space: Space = {
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'Diary',
  tool: 'notebook',
  carryOver: true,
  locked: true,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'me',
  ownerName: null,
};

const renderGate = () => render(<SpaceLockGateComponent space={space}>secret pages</SpaceLockGateComponent>);

beforeEach(() => {
  vi.clearAllMocks();
  unlocked.current = false;
});

it('hides the space until it is unlocked with its password', async () => {
  renderGate();
  expect(screen.getByRole('heading', { name: 'Diary is locked' })).toBeInTheDocument();
  expect(screen.queryByText('secret pages')).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Password'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  expect(unlock).toHaveBeenCalledWith({ id: 's1', password: 'secret' }, expect.anything());
});

it('shows the space once unlocked', () => {
  unlocked.current = true;
  renderGate();
  expect(screen.getByText('secret pages')).toBeInTheDocument();
});

it('does not offer someone it is shared with a way to remove the password', () => {
  render(
    <SpaceLockGateComponent space={{ ...space, access: 'edit', ownerName: 'Sam' }}>secret pages</SpaceLockGateComponent>,
  );
  expect(screen.getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Forgot the password?' })).not.toBeInTheDocument();
});

it('removes a forgotten password with the account password', async () => {
  renderGate();
  await userEvent.click(screen.getByRole('button', { name: 'Forgot the password?' }));
  await userEvent.type(screen.getByLabelText('Account password'), 'account-pass');
  await userEvent.click(screen.getByRole('button', { name: 'Remove password' }));
  expect(removePassword).toHaveBeenCalledWith({ id: 's1', accountPassword: 'account-pass' }, expect.anything());
});
