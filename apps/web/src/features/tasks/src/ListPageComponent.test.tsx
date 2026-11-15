import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ListPageComponent } from './ListPageComponent';
import type { Task } from './task-types';

const { useTasks, state, clearFilters, clearDialog } = vi.hoisted(() => ({
  clearDialog: vi.fn((_props: { tasks: { id: string; subtasks: unknown[] }[]; someHidden: boolean }) => null),
  useTasks: vi.fn(),
  state: { filters: { statuses: [] as string[], high: false }, params: new URLSearchParams(), access: 'owner' },
  clearFilters: vi.fn(),
}));

vi.mock('../hooks/useTasks', () => ({ useTasks }));
vi.mock('../hooks/useTaskFilters', () => ({
  useTaskFilters: () => ({ filters: state.filters, clearFilters }),
}));
vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ title: 'Home', access: state.access }) }));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-09' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => state.params }));
vi.mock('./TasksHeaderComponent', () => ({ TasksHeaderComponent: () => null }));
vi.mock('./TaskToolbarComponent', () => ({ TaskToolbarComponent: () => null }));
vi.mock('./TaskProgressComponent', () => ({ TaskProgressComponent: () => null }));
vi.mock('./TaskTableComponent', () => ({ TaskTableComponent: () => null }));
vi.mock('./TaskFormDialogComponent', () => ({ TaskFormDialogComponent: () => null }));
vi.mock('./ClearTableDialogComponent', () => ({ ClearTableDialogComponent: clearDialog }));

const task = (fields: Partial<Task>): Task => ({
  id: 't1',
  parentId: null,
  title: 'Task',
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

const renderWith = (tasks: Task[]) => {
  useTasks.mockReturnValue({ data: tasks, isPending: false, isError: false });
  render(<ListPageComponent />);
};

beforeEach(() => {
  vi.clearAllMocks();
  state.filters = { statuses: [], high: false };
  state.params = new URLSearchParams();
  state.access = 'owner';
});

it('offers a new task on an empty day', () => {
  renderWith([]);
  expect(screen.getByRole('heading', { name: 'Nothing planned for today' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
});

it('offers to clear filters when none of the tasks match', async () => {
  state.filters = { statuses: ['on_hold'], high: false };
  renderWith([task({})]);
  expect(screen.getByRole('heading', { name: 'No tasks match these filters' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(clearFilters).toHaveBeenCalled();
});

it('clears only the rows showing, each with all of its subtasks', () => {
  state.params = new URLSearchParams('closed=0');
  const doneSubtask = task({ id: 's1', parentId: 'open', finished: true });
  renderWith([task({ id: 'open', subtasks: [doneSubtask] }), task({ id: 'done', finished: true })]);
  const props = clearDialog.mock.calls[0][0];
  expect(props.tasks.map(({ id }) => id)).toEqual(['open']);
  expect(props.tasks[0].subtasks).toHaveLength(1);
  expect(props.someHidden).toBe(true);
});

it('points to Show closed when every task is finished and hidden', () => {
  state.params = new URLSearchParams('closed=0');
  renderWith([task({ finished: true })]);
  expect(screen.getByRole('heading', { name: 'Everything here is finished' })).toBeInTheDocument();
});

it('offers a viewer no way to add a task on an empty day', () => {
  state.access = 'view';
  renderWith([]);
  expect(screen.getByRole('heading', { name: 'Nothing planned for today' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument();
});
