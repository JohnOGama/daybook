import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { TaskToolbarComponent } from './TaskToolbarComponent';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/list',
  useSearchParams: () => new URLSearchParams('day=2026-11-08&status=todo'),
}));

const renderToolbar = () =>
  render(<TaskToolbarComponent day="2026-11-08" today="2026-11-09" onNewTask={() => {}} />);

beforeEach(() => vi.clearAllMocks());

it('Today clears the pinned date, so the view follows the real date past midnight', async () => {
  renderToolbar();
  await userEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(replace).toHaveBeenCalledWith('/list?status=todo');
});

it('stepping forward onto today clears the pinned date', async () => {
  renderToolbar();
  await userEvent.click(screen.getByRole('button', { name: 'Next day' }));
  expect(replace).toHaveBeenCalledWith('/list?status=todo');
});

it('stepping to another day pins that day', async () => {
  renderToolbar();
  await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
  expect(replace).toHaveBeenCalledWith('/list?day=2026-11-07&status=todo');
});
