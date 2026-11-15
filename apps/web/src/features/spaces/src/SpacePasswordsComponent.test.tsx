import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpacePasswordsComponent } from './SpacePasswordsComponent';
import type { Space } from './space-types';

const { setPassword, removePassword, lockNow, useSpaces, unlocked } = vi.hoisted(() => ({
  setPassword: vi.fn(),
  removePassword: vi.fn(),
  lockNow: vi.fn(),
  useSpaces: vi.fn(),
  unlocked: { current: false },
}));
vi.mock('../hooks/useSpaces', () => ({ useSpaces }));
vi.mock('../hooks/useSpaceLock', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSpaceUnlocked: () => ({ data: unlocked.current }),
  useSpaceLock: () => ({
    setPassword: { mutate: setPassword, isPending: false },
    removePassword: { mutate: removePassword, isPending: false },
    lockNow: { mutate: lockNow, isPending: false },
  }),
}));

const space: Space = {
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'Diary',
  tool: 'notebook',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'me',
  ownerName: null,
};

function show(spaces: Space[]) {
  useSpaces.mockReturnValue({ data: spaces, isPending: false, isError: false });
  render(<SpacePasswordsComponent />);
}

beforeEach(() => {
  vi.clearAllMocks();
  unlocked.current = false;
});

it('lists every space but vaults, with its folder and a password switch each', () => {
  show([
    space,
    { ...space, id: 'v', title: 'Secrets', tool: 'vault' },
    { ...space, id: 'f', kind: 'folder', title: 'Work', tool: null },
    { ...space, id: 'w', parentId: 'f', title: 'Tasks', tool: 'list', locked: true },
  ]);
  const [, diary, tasks] = screen.getAllByRole('row');
  expect(diary).toHaveTextContent('Diary');
  expect(diary).toHaveTextContent('No password');
  expect(tasks).toHaveTextContent('Work / Tasks');
  expect(within(tasks).getAllByText('Locked').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('row')).toHaveLength(3);
  expect(screen.getByRole('switch', { name: 'Password for Diary' })).not.toBeChecked();
  expect(screen.getByRole('switch', { name: 'Password for Tasks' })).toBeChecked();
});

it('leaves out spaces shared with me', () => {
  show([space, { ...space, id: 'theirs', title: 'Their Diary', access: 'edit', ownerName: 'Sam' }]);
  expect(screen.queryByText('Their Diary')).not.toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(2);
});

it('locks every space with a password at once', async () => {
  show([space, { ...space, id: 'a', locked: true }, { ...space, id: 'b', locked: true }]);
  await userEvent.click(screen.getByRole('button', { name: 'Lock all' }));
  expect(lockNow.mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
});

it('turning the switch on asks for a matching password', async () => {
  show([space]);
  await userEvent.click(screen.getByRole('switch', { name: 'Password for Diary' }));
  const dialog = screen.getByRole('dialog', { name: 'Add a password' });
  await userEvent.type(within(dialog).getByLabelText('New password'), 'secret');
  await userEvent.type(within(dialog).getByLabelText('Type it again'), 'secrex');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add password' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('do not match');
  expect(setPassword).not.toHaveBeenCalled();
  await userEvent.clear(within(dialog).getByLabelText('Type it again'));
  await userEvent.type(within(dialog).getByLabelText('Type it again'), 'secret');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add password' }));
  expect(setPassword).toHaveBeenCalledWith({ id: 's1', password: 'secret' }, expect.anything());
});

it('changes the password and locks an unlocked space', async () => {
  unlocked.current = true;
  show([{ ...space, locked: true }]);
  expect(screen.getAllByText('Unlocked here').length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole('button', { name: 'Lock now' }));
  expect(lockNow).toHaveBeenCalledWith('s1');
  await userEvent.click(screen.getByRole('button', { name: 'Change' }));
  const dialog = screen.getByRole('dialog', { name: 'Change password' });
  await userEvent.type(within(dialog).getByLabelText('Current password'), 'old1');
  await userEvent.type(within(dialog).getByLabelText('New password'), 'new1');
  await userEvent.type(within(dialog).getByLabelText('Type it again'), 'new1');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save password' }));
  expect(setPassword).toHaveBeenCalledWith({ id: 's1', password: 'new1', currentPassword: 'old1' }, expect.anything());
});

it('turning the switch off removes the password, with the account password if forgotten', async () => {
  show([{ ...space, locked: true }]);
  expect(screen.queryByRole('button', { name: 'Lock now' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('switch', { name: 'Password for Diary' }));
  const dialog = screen.getByRole('dialog', { name: 'Remove password' });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Forgot it? Use your account password' }));
  await userEvent.type(within(dialog).getByLabelText('Account password'), 'account-pass');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove password' }));
  expect(removePassword).toHaveBeenCalledWith({ id: 's1', accountPassword: 'account-pass' }, expect.anything());
});

it('shows and hides what was typed', async () => {
  show([space]);
  await userEvent.click(screen.getByRole('switch', { name: 'Password for Diary' }));
  const field = screen.getByLabelText('New password');
  expect(field).toHaveAttribute('type', 'password');
  await userEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
  expect(field).toHaveAttribute('type', 'text');
});
