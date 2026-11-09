import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { KanbanPageComponent } from './KanbanPageComponent';
import { SpaceSettingsPageComponent } from './SpaceSettingsPageComponent';
import { TasksHeaderComponent } from './TasksHeaderComponent';

const { active, replace } = vi.hoisted(() => ({
  active: { space: { id: 's1', title: 'Home', tool: 'list' as string | null } },
  replace: vi.fn(),
}));

vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => active.space,
  SpaceSettingsComponent: () => <p>settings content</p>,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-09' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/kanban',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../hooks/useTasks', () => ({ useTasks: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('../hooks/useTaskFilters', () => ({ useTaskFilters: () => ({ filters: { statuses: [], high: false } }) }));
vi.mock('./FiltersMenuComponent', () => ({ FiltersMenuComponent: () => null }));
vi.mock('./KanbanBoardComponent', () => ({ KanbanBoardComponent: () => <p>board</p> }));
vi.mock('./TaskFormDialogComponent', () => ({ TaskFormDialogComponent: () => null }));

const kanbanTab = () => screen.queryByRole('link', { name: 'Kanban' });

beforeEach(() => {
  vi.clearAllMocks();
  active.space = { id: 's1', title: 'Home', tool: 'list' };
});

const settings = () => screen.queryByRole('link', { name: 'Settings' });

it('opens Settings as a page of its own, under the same tabs', () => {
  render(<SpaceSettingsPageComponent />);
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByText('settings content')).toBeInTheDocument();
  expect(settings()).toHaveAttribute('href', '/settings');
});

it('offers the Kanban tab and Settings in a list space, with Settings last', () => {
  render(<TasksHeaderComponent title="t" subtitle="s" />);
  expect(kanbanTab()).toHaveAttribute('href', '/kanban');
  expect(kanbanTab()?.nextElementSibling).toBe(settings());
});

it('hides the Kanban tab and Settings for any other tool', () => {
  active.space.tool = 'notes';
  render(<TasksHeaderComponent title="t" subtitle="s" />);
  expect(kanbanTab()).not.toBeInTheDocument();
  expect(settings()).not.toBeInTheDocument();
});

it('shows the board in a list space', () => {
  render(<KanbanPageComponent />);
  expect(screen.getByText('board')).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it('sends any other tool away from the board', () => {
  active.space.tool = 'notes';
  render(<KanbanPageComponent />);
  expect(screen.queryByText('board')).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith('/list?space=s1');
});
