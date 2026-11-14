import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpaceContextMenuComponent } from './SpaceContextMenuComponent';
import type { Space } from './space-types';

const { remove, duplicate, move, spaces } = vi.hoisted(() => ({ remove: vi.fn(), duplicate: vi.fn(), move: vi.fn(), spaces: { current: [] as unknown[] } }));

vi.mock('../hooks/useDeleteSpace', () => ({ useDeleteSpace: () => ({ mutate: remove }) }));
vi.mock('../hooks/useDuplicateSpace', () => ({ useDuplicateSpace: () => ({ mutate: duplicate }) }));
vi.mock('../hooks/useMoveSpace', () => ({ useMoveSpace: () => ({ mutate: move }) }));
vi.mock('../hooks/useSpaces', () => ({ useSpaces: () => ({ data: spaces.current }) }));

const space: Space = {
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'Home',
  tool: 'list',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
};
const folder: Space = { ...space, kind: 'folder', tool: null, title: 'Team' };
const onEdit = vi.fn();

async function rightClick(target: Space) {
  render(
    <SpaceContextMenuComponent space={target} onEdit={onEdit}>
      <div>the row</div>
    </SpaceContextMenuComponent>,
  );
  fireEvent.contextMenu(screen.getByText('the row'));
  const items = await screen.findAllByRole('menuitem');
  return items.map((item) => item.textContent);
}

async function askToDelete(target: Space) {
  await rightClick(target);
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
  return screen.findByRole('alertdialog');
}

beforeEach(() => {
  vi.clearAllMocks();
  spaces.current = [];
});

it('a space offers Edit, Duplicate and Delete', async () => {
  expect(await rightClick(space)).toEqual(['Edit', 'Duplicate', 'Delete']);
});

it('moves a space into another folder, and does not offer the folder it is already in', async () => {
  const inside = { ...space, parentId: 'f1' };
  spaces.current = [{ ...folder, id: 'f1', title: 'Team' }, { ...folder, id: 'f2', title: 'Home' }, inside];
  expect(await rightClick(inside)).toEqual(['Edit', 'Duplicate', 'Move to', 'Delete']);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Move to' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Home' }));
  expect(screen.queryByRole('menuitem', { name: 'Team' })).not.toBeInTheDocument();
  expect(move).toHaveBeenCalledWith({ id: 's1', parentId: 'f2' });
});

it('a folder offers Edit and Delete', async () => {
  expect(await rightClick(folder)).toEqual(['Edit', 'Delete']);
});

it('Edit starts only after the menu has closed, so the label input can take focus', async () => {
  let menuStillOpen = true;
  onEdit.mockImplementation(() => {
    menuStillOpen = screen.queryByRole('menu') !== null;
  });
  await rightClick(space);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
  expect(menuStillOpen).toBe(false);
});

it('closing the menu without choosing Edit does not start editing', async () => {
  await rightClick(space);
  await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(onEdit).not.toHaveBeenCalled();
});

it('Duplicate duplicates the space', async () => {
  await rightClick(space);
  await userEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(duplicate).toHaveBeenCalledWith(space);
});

it('deletes only after confirming', async () => {
  const dialog = await askToDelete(space);
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(remove).toHaveBeenCalledWith('s1');
});

it('Cancel deletes nothing', async () => {
  const dialog = await askToDelete(space);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(remove).not.toHaveBeenCalled();
});

it('says a space goes to Trash with its tasks', async () => {
  const dialog = await askToDelete(space);
  expect(dialog).toHaveTextContent('"Home" and all its tasks will move to Trash');
});

it('says a folder goes to Trash with its spaces', async () => {
  const dialog = await askToDelete(folder);
  expect(dialog).toHaveTextContent('"Team", the spaces inside it, and all their tasks will move to Trash');
});

it('offers no Duplicate for a vault space', async () => {
  expect(await rightClick({ ...space, tool: 'vault' })).toEqual(['Edit', 'Delete']);
});

it('offers Duplicate for a database diagram space', async () => {
  expect(await rightClick({ ...space, tool: 'diagram' })).toEqual(['Edit', 'Duplicate', 'Delete']);
});

it('says a database diagram goes to Trash with its diagram', async () => {
  expect(await askToDelete({ ...space, tool: 'diagram' })).toHaveTextContent('its diagram');
});

it('offers no Duplicate for a job hunt space', async () => {
  expect(await rightClick({ ...space, tool: 'jobs' })).toEqual(['Edit', 'Delete']);
});

it('says a job hunt goes to Trash with its jobs and CV', async () => {
  expect(await askToDelete({ ...space, tool: 'jobs' })).toHaveTextContent('jobs and your CV');
});

it('says a vault goes to Trash with its items', async () => {
  const dialog = await askToDelete({ ...space, tool: 'vault' });
  expect(dialog).toHaveTextContent('all its items');
});
