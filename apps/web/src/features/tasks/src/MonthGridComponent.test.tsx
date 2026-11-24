import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { monthGrid } from './calendar-grid';
import { MonthGridComponent } from './MonthGridComponent';
import type { Task } from './task-types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function task(id: string, title: string, plannedDay: string, day: string): Task {
  return {
    id,
    parentId: null,
    title,
    status: 'in_progress',
    highPriority: false,
    finished: false,
    day,
    plannedDay,
    completedOn: null,
    dueDay: null,
    createdAt: `${plannedDay}T12:00:00.000Z`,
    subtasks: [],
  };
}

const onSelectTask = vi.fn();

function renderGrid(tasks: Task[]) {
  render(
    <MonthGridComponent
      days={monthGrid('2026-11')}
      month="2026-11"
      today="2026-11-21"
      tasks={tasks}
      filterParams={new URLSearchParams()}
      onSelectTask={onSelectTask}
    />,
  );
}

beforeEach(() => {
  push.mockClear();
  onSelectTask.mockClear();
});

it('shows a four-day task once, with its length', () => {
  renderGrid([task('m', 'Migration site', '2026-11-18', '2026-11-21')]);
  expect(screen.getAllByRole('button', { name: 'Migration site · 4 days' })).toHaveLength(1);
});

it('shows a one-day task without a length', () => {
  renderGrid([task('s', 'Standup', '2026-11-21', '2026-11-21')]);
  expect(screen.getByRole('button', { name: 'Standup' })).toBeInTheDocument();
});

it('opens the task from its bar without opening the day', async () => {
  renderGrid([task('m', 'Migration site', '2026-11-18', '2026-11-21')]);
  await userEvent.click(screen.getByRole('button', { name: 'Migration site · 4 days' }));
  expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  expect(push).not.toHaveBeenCalled();
});

it('shows +N more on each day a hidden bar covers', () => {
  renderGrid(['a', 'b', 'c', 'd'].map((id) => task(id, id, '2026-11-17', '2026-11-19')));
  expect(screen.getAllByText('+1 more')).toHaveLength(3);
});

it('repeats a bar on each week it crosses', () => {
  renderGrid([task('w', 'Long job', '2026-11-20', '2026-11-24')]);
  expect(screen.getAllByRole('button', { name: 'Long job · 5 days' })).toHaveLength(2);
});

it('gives a finished bar a visible fill', () => {
  const done = { ...task('f', 'Report', '2026-11-16', '2026-11-19'), finished: true, completedOn: '2026-11-19' };
  renderGrid([done]);
  expect(screen.getByRole('button', { name: 'Report · 4 days' }).className).toMatch(/\bbg-muted\b/);
});
