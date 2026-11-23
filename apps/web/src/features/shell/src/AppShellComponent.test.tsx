import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AppShellComponent } from './AppShellComponent';

const { useSpaces, pathname, passThrough } = vi.hoisted(() => ({
  useSpaces: vi.fn(),
  pathname: { current: '/list' },
  passThrough: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => pathname.current,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/shared/services/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { name: 'Sam' } }, isPending: false }) } }));
vi.mock('@/features/spaces', () => ({ useSpaces, SpaceGateComponent: passThrough }));
vi.mock('@/features/assistant', () => ({ AssistantPanelComponent: () => null }));
vi.mock('@/features/tasks', () => ({ TaskMutationsProviderComponent: passThrough }));
vi.mock('@/features/vault', () => ({ VaultSessionProviderComponent: passThrough }));
vi.mock('./LiveUpdatesProviderComponent', () => ({ LiveUpdatesProviderComponent: passThrough }));
vi.mock('./SidebarComponent', () => ({ SidebarComponent: () => <nav aria-label="Main" /> }));
vi.mock('./FirstRunBarComponent', () => ({ FirstRunBarComponent: () => <header>first run bar</header> }));

const space = { id: 's', kind: 'space' };
const renderShell = () => render(<AppShellComponent>page</AppShellComponent>);

beforeEach(() => {
  pathname.current = '/list';
});

it('hides the sidebar until the first space exists', () => {
  useSpaces.mockReturnValue({ data: [{ id: 'f', kind: 'folder' }] });
  renderShell();
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  expect(screen.getByText('first run bar')).toBeInTheDocument();
});

it('shows the sidebar once there is a space', () => {
  useSpaces.mockReturnValue({ data: [space] });
  renderShell();
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  expect(screen.queryByText('first run bar')).not.toBeInTheDocument();
});

it('keeps the sidebar while spaces load, and on Settings with no spaces', () => {
  useSpaces.mockReturnValue({ data: undefined });
  const { unmount } = renderShell();
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  unmount();

  pathname.current = '/preferences';
  useSpaces.mockReturnValue({ data: [] });
  renderShell();
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
});
