import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TrashPageComponent } from './TrashPageComponent';

const { useTrash, restore } = vi.hoisted(() => ({ useTrash: vi.fn(), restore: vi.fn() }));

vi.mock('../hooks/useTrash', () => ({ useTrash }));
vi.mock('../hooks/useRestoreItem', () => ({ useRestoreItem: () => ({ mutate: restore }) }));

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
