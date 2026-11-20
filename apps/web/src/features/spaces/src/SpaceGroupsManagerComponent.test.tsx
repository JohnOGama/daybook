import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpaceGroupsManagerComponent } from './SpaceGroupsManagerComponent';
import type { Space } from './space-types';

const { create, rename, remove, groups } = vi.hoisted(() => ({
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  groups: { current: [] as { id: string; title: string }[] },
}));
vi.mock('../hooks/useSpaceGroups', () => ({
  useSpaceGroups: () => ({ data: groups.current, isPending: false, isError: false }),
  useCreateSpaceGroup: () => create,
  useRenameSpaceGroup: () => ({ mutate: rename }),
  useDeleteSpaceGroup: () => ({ mutate: remove }),
}));

const space = (id: string, groupId: string): Space => ({
  id, parentId: null, groupId, kind: 'space', title: id, tool: 'list', carryOver: true, locked: false,
  createdAt: '', openToday: 0, access: 'owner', shared: false, ownerId: 'me', ownerName: null,
});
vi.mock('../hooks/useSpaces', () => ({ useSpaces: () => ({ data: [space('a', 'g1'), space('b', 'g2'), space('c', 'g2')] }) }));

beforeEach(() => {
  vi.clearAllMocks();
  groups.current = [
    { id: 'g1', title: 'Spaces' },
    { id: 'g2', title: 'Work' },
  ];
});

it('lists each group with how many top-level items it holds', () => {
  render(<SpaceGroupsManagerComponent />);
  expect(screen.getByRole('row', { name: /Spaces 1 item/ })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: /Work 2 items/ })).toBeInTheDocument();
});

it('creates a group', async () => {
  render(<SpaceGroupsManagerComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'New group' }));
  await userEvent.type(await screen.findByRole('textbox', { name: 'Group name' }), 'Side projects');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(create).toHaveBeenCalledWith('Side projects');
});

it('renames a group, including the default one', async () => {
  render(<SpaceGroupsManagerComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Rename Spaces' }));
  const input = await screen.findByRole('textbox', { name: 'Group name' });
  await userEvent.clear(input);
  await userEvent.type(input, 'Personal');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(rename).toHaveBeenCalledWith({ id: 'g1', title: 'Personal' });
});

it('deletes a group only after confirming, and never your only group', async () => {
  const { unmount } = render(<SpaceGroupsManagerComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Delete Work' }));
  expect(remove).not.toHaveBeenCalled();
  expect(await screen.findByText(/Its 2 folders and spaces/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('g2');
  unmount();

  groups.current = [{ id: 'g1', title: 'Spaces' }];
  render(<SpaceGroupsManagerComponent />);
  expect(screen.getByRole('button', { name: 'Delete Spaces' })).toBeDisabled();
});
