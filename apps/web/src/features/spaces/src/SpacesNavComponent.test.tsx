import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpacesNavComponent } from './SpacesNavComponent';
import type { Space } from './space-types';

const space = (id: string, title: string, fields: Partial<Space> = {}): Space => ({
  id,
  parentId: null,
  kind: 'space',
  title,
  tool: 'list',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'me',
  ownerName: null,
  ...fields,
});

const ownSpaces = [
  space('guide', 'Team Setup Guide', { openToday: 2 }),
  space('team', 'Design Team', { kind: 'folder', tool: null }),
  space('requests', 'Design Requests', { parentId: 'team', openToday: 7 }),
];
let data = ownSpaces;

vi.mock('../hooks/useSpaces', () => ({ useSpaces: () => ({ data }) }));
vi.mock('../hooks/useSpaceGroups', () => ({ useSpaceGroups: () => ({ data: [{ id: 'g1', title: 'Spaces' }] }), useMoveToGroup: () => ({ mutate: vi.fn() }) }));
vi.mock('../hooks/useActiveSpace', () => ({ useActiveSpace: () => data[2] }));
vi.mock('../hooks/useCreateSpace', () => ({ useCreateSpace: () => ({ mutateAsync: vi.fn() }) }));
const { rename } = vi.hoisted(() => ({ rename: vi.fn() }));

vi.mock('../hooks/useDeleteSpace', () => ({ useDeleteSpace: () => ({ mutate: vi.fn() }) }));
vi.mock('../hooks/useDuplicateSpace', () => ({ useDuplicateSpace: () => ({ mutate: vi.fn() }) }));
vi.mock('../hooks/useMoveSpace', () => ({ useMoveSpace: () => ({ mutate: vi.fn() }) }));
vi.mock('../hooks/useShares', () => ({ useLeaveShare: () => ({ mutate: vi.fn() }) }));
vi.mock('../hooks/useRenameSpace', () => ({ useRenameSpace: () => ({ mutate: rename }) }));
vi.mock('../hooks/useReorderSpaces', () => ({ useReorderSpaces: () => ({ mutate: vi.fn() }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  data = ownSpaces;
  render(<SpacesNavComponent />);
});

function showWith(spaces: Space[]) {
  cleanup();
  data = spaces;
  render(<SpacesNavComponent />);
}

const fromSam = { access: 'view', ownerId: 'sam', ownerName: 'Sam' } as const;

it('hides Shared with me when nothing is shared', () => {
  expect(screen.queryByText('Shared with me')).not.toBeInTheDocument();
});

it('lists spaces shared with me under their own heading, with the owner name and no drag handles', () => {
  showWith([
    ...ownSpaces,
    space('theirs', 'Their Plans', fromSam),
    space('other', 'Other Plans', fromSam),
  ]);
  expect(screen.getByText('Shared with me')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Their Plans/ })).toHaveTextContent('Sam');
  expect(screen.queryByRole('button', { name: 'Reorder Their Plans' })).not.toBeInTheDocument();
});

it('puts a shared folder with its spaces in Shared with me, with no new space button', () => {
  showWith([
    ...ownSpaces,
    space('their-folder', 'Their Folder', { ...fromSam, kind: 'folder', tool: null }),
    space('inside', 'Inside Theirs', { ...fromSam, parentId: 'their-folder' }),
  ]);
  expect(screen.getByRole('button', { name: /^Their Folder/ })).toHaveTextContent('Sam');
  expect(screen.getByRole('link', { name: /Inside Theirs/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New space in Their Folder' })).not.toBeInTheDocument();
});

it('marks my own shared spaces', () => {
  showWith([space('mine', 'Mine Shared', { shared: true }), space('alone', 'Not Shared')]);
  expect(screen.getByRole('link', { name: /Mine Shared/ })).toContainElement(screen.getByLabelText('Shared'));
  expect(screen.getAllByLabelText('Shared')).toHaveLength(1);
});

it('links each space to its tool with its count', () => {
  const link = screen.getByRole('link', { name: /Team Setup Guide/ });
  expect(link).toHaveAttribute('href', '/list?space=guide');
  expect(link).toHaveTextContent('2');
});

it('shows an open folder icon while open and a closed one while closed', async () => {
  const toggle = screen.getByRole('button', { name: 'Design Team' });
  expect(toggle.querySelector('[data-glyph="folder-open"]')).toBeInTheDocument();
  await userEvent.click(toggle);
  expect(toggle.querySelector('[data-glyph="folder-open"]')).not.toBeInTheDocument();
  expect(toggle.querySelector('[data-glyph="folder"]')).toBeInTheDocument();
});

it('double-clicking a space edits its label and Enter saves', async () => {
  rename.mockClear();
  await userEvent.dblClick(screen.getByText('Team Setup Guide'));
  const input = screen.getByRole('textbox', { name: 'Title of Team Setup Guide' });
  expect(input).toHaveFocus();
  await userEvent.clear(input);
  await userEvent.type(input, 'Guide{Enter}');
  expect(rename).toHaveBeenCalledWith({ id: 'guide', title: 'Guide' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('double-clicking a folder edits its label', async () => {
  rename.mockClear();
  await userEvent.dblClick(screen.getByText('Design Team'));
  const input = screen.getByRole('textbox', { name: 'Title of Design Team' });
  await userEvent.type(input, ' two{Enter}');
  expect(rename).toHaveBeenCalledWith({ id: 'team', title: 'Design Team two' });
});

it('Escape cancels a label edit', async () => {
  rename.mockClear();
  await userEvent.dblClick(screen.getByText('Team Setup Guide'));
  await userEvent.keyboard('{Escape}');
  expect(rename).not.toHaveBeenCalled();
  expect(screen.getByText('Team Setup Guide')).toBeInTheDocument();
});

it('offers a drag handle only where there is something to swap with', () => {
  expect(screen.getByRole('button', { name: 'Reorder Team Setup Guide' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reorder Design Team' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reorder Design Requests' })).not.toBeInTheDocument();
});

it('the ⋯ button on a row opens the same menu as right-click', async () => {
  await userEvent.click(screen.getByRole('button', { name: 'More for Design Team' }));
  expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
});

it.each([
  ['a space', () => screen.getByRole('link', { name: /Team Setup Guide/ })],
  ['a folder', () => screen.getByRole('button', { name: 'Design Team' })],
])('right-clicking %s offers Delete', async (_, getRow) => {
  fireEvent.contextMenu(getRow());
  expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
});

it('marks the open space', () => {
  expect(screen.getByRole('link', { name: /Design Requests/ })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: /Team Setup Guide/ })).not.toHaveAttribute('aria-current');
});

it('clicking a folder closes and reopens its group', async () => {
  const toggle = screen.getByRole('button', { name: 'Design Team' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('link', { name: /Design Requests/ })).not.toBeInTheDocument();
  await userEvent.click(toggle);
  expect(screen.getByRole('link', { name: /Design Requests/ })).toBeInTheDocument();
});

it.each([
  ['Space', 'New space', true],
  ['Folder', 'New folder', false],
])('the Spaces plus offers %s, which opens the %s dialog', async (choice, title, hasTools) => {
  await userEvent.click(screen.getByRole('button', { name: 'Add to Spaces' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: choice }));
  expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument();
  expect(screen.queryByText('Tool') !== null).toBe(hasTools);
});

it('a folder plus opens the New space dialog inside that folder', async () => {
  await userEvent.click(screen.getByRole('button', { name: 'New space in Design Team' }));
  expect(await screen.findByRole('dialog', { name: 'New space' })).toBeInTheDocument();
  expect(screen.getByText('In Design Team')).toBeInTheDocument();
});
