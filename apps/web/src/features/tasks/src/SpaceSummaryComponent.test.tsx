import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SpaceSummaryComponent } from './SpaceSummaryComponent';
import type { Task } from './task-types';

const { useSpaceTodayTasks } = vi.hoisted(() => ({ useSpaceTodayTasks: vi.fn() }));

vi.mock('../hooks/useSpaceTodayTasks', () => ({ useSpaceTodayTasks }));

const task = (id: string, fields: Partial<Task> = {}): Task => ({
  id,
  parentId: null,
  title: id,
  status: 'todo',
  highPriority: false,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  dueDay: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
  ...fields,
});

const renderWith = (result: object) => {
  useSpaceTodayTasks.mockReturnValue(result);
  render(<SpaceSummaryComponent spaceId="s1" />);
};

it('shows progress, high priority left and open tasks first', () => {
  renderWith({ data: [task('done', { finished: true }), task('open', { highPriority: true })], isPending: false });
  expect(screen.getByText('50%')).toBeInTheDocument();
  expect(screen.getByText('1 of 2 done today')).toBeInTheDocument();
  expect(screen.getByText('1 high priority left')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['open', 'done']);
});

it('lists at most five tasks and counts the rest', () => {
  renderWith({ data: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => task(id)), isPending: false });
  expect(screen.getAllByRole('listitem')).toHaveLength(6);
  expect(screen.getByText('+2 more')).toBeInTheDocument();
});

it('says when nothing is planned', () => {
  renderWith({ data: [], isPending: false });
  expect(screen.getByText('Nothing planned for today.')).toBeInTheDocument();
});

it('reports a load failure', () => {
  renderWith({ data: undefined, isPending: false, isError: true });
  expect(screen.getByText('Could not load this space.')).toBeInTheDocument();
});
