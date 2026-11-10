import type { ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { keepRowInTable, TaskTableComponent } from './TaskTableComponent';
import type { Task } from './task-types';

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ reorder: { mutate: vi.fn() }, setFinished: { mutate: vi.fn(), isPending: false } }),
}));
vi.mock('./TaskRowContextMenuComponent', () => ({
  TaskRowContextMenuComponent: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./TaskRowMenuComponent', () => ({ TaskRowMenuComponent: () => null }));
vi.mock('./TaskFormDialogComponent', () => ({ TaskFormDialogComponent: () => null }));
vi.mock('./TaskDeleteDialogComponent', () => ({ TaskDeleteDialogComponent: () => null }));
vi.mock('./TaskTitleComponent', () => ({ TaskTitleComponent: () => null }));
vi.mock('./StatusPillComponent', () => ({ StatusPillComponent: () => null }));
vi.mock('./PriorityPillComponent', () => ({ PriorityPillComponent: () => null }));

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
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
  ...fields,
});

const renderTable = (tasks: Task[]) => render(<TaskTableComponent tasks={tasks} allTasks={tasks} />);
const handle = (title: string) => screen.queryByRole('button', { name: `Reorder ${title}` });

it('has no drag handle for an only task', () => {
  renderTable([task('a')]);
  expect(handle('a')).not.toBeInTheDocument();
});

it('has drag handles when tasks can swap places', () => {
  renderTable([task('a'), task('b')]);
  expect(handle('a')).toBeInTheDocument();
  expect(handle('b')).toBeInTheDocument();
});

it('counts subtasks only against their own siblings', () => {
  renderTable([
    task('a', { subtasks: [task('a1', { parentId: 'a' })] }),
    task('b', { subtasks: [task('b1', { parentId: 'b' }), task('b2', { parentId: 'b' })] }),
  ]);
  expect(handle('a')).toBeInTheDocument();
  expect(handle('a1')).not.toBeInTheDocument();
  expect(handle('b1')).toBeInTheDocument();
});

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
let watching: ObserverCallback | undefined;

beforeEach(() => {
  localStorage.clear();
  watching = undefined;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private callback: ObserverCallback) {}
      observe() {
        watching = this.callback;
      }
      disconnect() {
        watching = undefined;
      }
    },
  );
});

const manyTasks = (count: number) => Array.from({ length: count }, (_, index) => task(`t${index + 1}`));
const finishBoxes = () => screen.queryAllByRole('checkbox', { name: /^Finish / });
const button = (name: string) => screen.getByRole('button', { name });
const reachEnd = () => act(() => watching?.([{ isIntersecting: true }]));

it('does not watch for more when everything is showing', () => {
  renderTable(manyTasks(10));
  expect(finishBoxes()).toHaveLength(10);
  expect(watching).toBeUndefined();
});

it('adds tasks each time the end is reached, then stops watching', () => {
  renderTable(manyTasks(25));
  expect(finishBoxes()).toHaveLength(10);

  reachEnd();
  expect(finishBoxes()).toHaveLength(20);

  reachEnd();
  expect(finishBoxes()).toHaveLength(25);
  expect(watching).toBeUndefined();
});

it('adds nothing while the end is out of view', () => {
  renderTable(manyTasks(25));
  act(() => watching?.([{ isIntersecting: false }]));
  expect(finishBoxes()).toHaveLength(10);
});

it('counts top-level tasks and keeps subtasks with their parent', () => {
  const [first, ...rest] = manyTasks(11);
  renderTable([{ ...first, subtasks: [task('child', { parentId: 't1' })] }, ...rest]);
  expect(finishBoxes()).toHaveLength(11);
  expect(screen.getByRole('checkbox', { name: 'Finish child' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Finish t11' })).not.toBeInTheDocument();
});

it('keeps a task collapsed after a refresh', async () => {
  const tasks = [task('a', { subtasks: [task('a1', { parentId: 'a' })] })];
  const { unmount } = render(<TaskTableComponent tasks={tasks} allTasks={tasks} />);
  await userEvent.click(button('Collapse a'));
  unmount();

  render(<TaskTableComponent tasks={tasks} allTasks={tasks} />);
  expect(screen.queryByRole('checkbox', { name: 'Finish a1' })).not.toBeInTheDocument();
  await userEvent.click(button('Expand a'));
  expect(screen.getByRole('checkbox', { name: 'Finish a1' })).toBeInTheDocument();
});

it('ignores unreadable saved collapse data', () => {
  localStorage.setItem('daybook.collapsed-tasks', 'not json');
  const tasks = [task('a', { subtasks: [task('a1', { parentId: 'a' })] })];
  renderTable(tasks);
  expect(screen.getByRole('checkbox', { name: 'Finish a1' })).toBeInTheDocument();
});

const deepTask = () =>
  task('a', {
    subtasks: [
      task('b', {
        parentId: 'a',
        subtasks: [task('c', { parentId: 'b', subtasks: [task('d', { parentId: 'c' })] })],
      }),
    ],
  });

it('shows every level, each indented further than the last', () => {
  renderTable([deepTask()]);
  const finishBox = (title: string) => screen.getByRole('checkbox', { name: `Finish ${title}` });
  const indent = (title: string) => (finishBox(title).parentElement as HTMLElement).style.paddingLeft;
  expect(finishBox('d')).toBeInTheDocument();
  expect([indent('b'), indent('c'), indent('d')]).toEqual(['0px', '20px', '40px']);
});

it('collapsing a middle level hides only what is under it', async () => {
  renderTable([deepTask()]);
  await userEvent.click(screen.getByRole('button', { name: 'Collapse c' }));
  expect(screen.getByRole('checkbox', { name: 'Finish c' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Finish d' })).not.toBeInTheDocument();
});

it('shows the completed date, or a dash when the task is open', () => {
  renderTable([task('a', { finished: true, completedOn: '2026-11-09' }), task('b')]);
  const completedCell = (row: number) => screen.getAllByRole('row')[row].querySelectorAll('td')[6].textContent;
  expect(screen.getByRole('columnheader', { name: /Completed at/ })).toBeInTheDocument();
  expect(completedCell(1)).toBe('9 Nov');
  expect(completedCell(2)).toBe('-');
});

const clampY = (y: number) =>
  keepRowInTable({
    transform: { x: 30, y, scaleX: 1, scaleY: 1 },
    draggingNodeRect: { top: 100, bottom: 146 },
    containerNodeRect: { top: 54, bottom: 192 },
  } as Parameters<typeof keepRowInTable>[0]);

it('keeps a dragged row inside the table and on its vertical axis', () => {
  expect(clampY(20)).toMatchObject({ x: 0, y: 20 });
  expect(clampY(500)).toMatchObject({ x: 0, y: 46 });
  expect(clampY(-500)).toMatchObject({ x: 0, y: -46 });
});
