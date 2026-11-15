import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SidebarComponent } from './SidebarComponent';

const { pathname } = vi.hoisted(() => ({ pathname: { current: '/assistant' } }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/spaces', () => ({ SpacesNavComponent: () => null }));
vi.mock('@/features/tasks', () => ({ SpaceSummaryComponent: () => null }));
vi.mock('@/shared/services/auth-client', () => ({ authClient: { signOut: vi.fn() } }));

const renderSidebar = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SidebarComponent />
    </QueryClientProvider>,
  );

it('links to the assistant and marks it current on /assistant', () => {
  pathname.current = '/assistant';
  renderSidebar();
  const link = screen.getByRole('link', { name: 'Assistant' });
  expect(link).toHaveAttribute('href', '/assistant');
  expect(link).toHaveAttribute('aria-current', 'page');
});

it('does not mark the assistant current elsewhere', () => {
  pathname.current = '/list';
  renderSidebar();
  expect(screen.getByRole('link', { name: 'Assistant' })).not.toHaveAttribute('aria-current');
});
