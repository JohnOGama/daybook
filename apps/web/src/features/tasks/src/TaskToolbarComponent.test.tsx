import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskToolbarComponent } from './TaskToolbarComponent';

const { replace, query } = vi.hoisted(() => ({ replace: vi.fn(), query: { current: '' } }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/list',
  useSearchParams: () => new URLSearchParams(query.current),
}));

vi.mock('./FiltersMenuComponent', () => ({ FiltersMenuComponent: () => null }));

const renderToolbar = () => render(<TaskToolbarComponent onNewTask={() => {}} />);

beforeEach(() => vi.clearAllMocks());

it('hiding closed tasks keeps the rest of the URL', async () => {
  query.current = 'day=2026-11-08&status=todo';
  renderToolbar();
  await userEvent.click(screen.getByRole('button', { name: 'Show closed' }));
  expect(replace).toHaveBeenCalledWith('/list?day=2026-11-08&status=todo&closed=0');
});

it('showing closed tasks again clears the setting', async () => {
  query.current = 'closed=0';
  renderToolbar();
  await userEvent.click(screen.getByRole('button', { name: 'Show closed' }));
  expect(replace).toHaveBeenCalledWith('/list?');
});

it('offers Clear table only when the page allows it', async () => {
  query.current = '';
  const onClearTable = vi.fn();
  const { rerender } = render(<TaskToolbarComponent onNewTask={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Clear table' })).not.toBeInTheDocument();
  rerender(<TaskToolbarComponent onNewTask={() => {}} onClearTable={onClearTable} />);
  await userEvent.click(screen.getByRole('button', { name: 'Clear table' }));
  expect(onClearTable).toHaveBeenCalled();
});

it('groups its actions together', () => {
  query.current = '';
  renderToolbar();
  expect(screen.getByRole('group', { name: 'Task actions' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
});
