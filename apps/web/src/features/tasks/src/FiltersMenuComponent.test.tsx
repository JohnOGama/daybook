import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FiltersMenuComponent } from './FiltersMenuComponent';
import type { Task } from './task-types';

const { toggleStatus, toggleHigh } = vi.hoisted(() => ({ toggleStatus: vi.fn(), toggleHigh: vi.fn() }));

const task = (id: string, fields: Partial<Task>): Task => ({
  id,
  parentId: null,
  title: id,
  status: 'todo',
  highPriority: false,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
  ...fields,
});

vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({
    data: [task('a', {}), task('b', {}), task('c', { status: 'in_progress', highPriority: true })],
  }),
}));
vi.mock('../hooks/useTaskFilters', () => ({
  useTaskFilters: () => ({ filters: { statuses: ['todo'], high: false }, toggleStatus, toggleHigh }),
}));

async function openMenu() {
  render(<FiltersMenuComponent />);
  await userEvent.click(screen.getByRole('button', { name: /^Filters/ }));
}

beforeEach(() => vi.clearAllMocks());

it('shows how many of today\'s tasks each filter covers', async () => {
  await openMenu();
  expect(await screen.findByRole('checkbox', { name: 'To do 2' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'In progress 1' })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'On hold 0' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'High priority 1' })).toBeInTheDocument();
});

it('toggles a status filter', async () => {
  await openMenu();
  await userEvent.click(await screen.findByRole('checkbox', { name: 'In progress 1' }));
  expect(toggleStatus).toHaveBeenCalledWith('in_progress');
});

it('toggles the high priority filter', async () => {
  await openMenu();
  await userEvent.click(await screen.findByRole('checkbox', { name: 'High priority 1' }));
  expect(toggleHigh).toHaveBeenCalled();
});
