import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Table, TableBody } from '@/shared/components/ui/table';
import { KanbanBoardComponent } from './KanbanBoardComponent';
import { MonthGridComponent } from './MonthGridComponent';
import { TaskRowComponent } from './TaskRowComponent';
import { TaskToolbarComponent } from './TaskToolbarComponent';
import type { Task } from './task-types';

vi.mock('../hooks/useTaskMutations', () => ({
  useTaskMutations: () => ({ update: { mutate: vi.fn() }, setFinished: { mutate: vi.fn() }, copy: { mutate: vi.fn() } }),
}));
vi.mock('@/features/spaces', () => ({ useSpaces: () => ({ data: [] }), useActiveSpace: () => undefined }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/list',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./FiltersMenuComponent', () => ({ FiltersMenuComponent: () => null }));

const task: Task = {
  id: 't1',
  parentId: null,
  title: 'Task one',
  status: 'todo',
  highPriority: true,
  finished: false,
  day: '2026-11-09',
  plannedDay: '2026-11-09',
  completedOn: null,
  createdAt: '2026-11-06T10:00:00.000Z',
  subtasks: [],
};

it('a viewer gets a task row with no controls that change anything', async () => {
  render(
    <DndContext>
      <SortableContext items={['t1']}>
        <Table>
          <TableBody>
            <TaskRowComponent task={task} canReorder={false} canEdit={false} />
          </TableBody>
        </Table>
      </SortableContext>
    </DndContext>,
  );
  expect(screen.getByRole('checkbox', { name: 'Finish Task one' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Reorder|Actions for|high priority/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Status of/ })).not.toBeInTheDocument();
  await userEvent.dblClick(screen.getByText('Task one'));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Task one') });
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
});

it('a viewer gets a board whose cards cannot be moved or opened for editing', async () => {
  render(<KanbanBoardComponent tasks={[task]} canEdit={false} />);
  expect(screen.queryByRole('button', { name: 'Move Task one' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Task one' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('a viewer cannot open a calendar entry to edit it', () => {
  render(
    <MonthGridComponent
      days={['2026-11-09']}
      month="2026-11"
      today="2026-11-09"
      tasks={[task]}
      filterParams={new URLSearchParams()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Task one' })).toBeDisabled();
});

it('a viewer gets no New task or Clear table', () => {
  render(<TaskToolbarComponent onNewTask={() => {}} onClearTable={() => {}} canEdit={false} />);
  expect(screen.getByRole('button', { name: 'Show closed' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /New task|Clear table/ })).not.toBeInTheDocument();
});
