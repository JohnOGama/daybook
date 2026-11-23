import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpaceGateComponent } from './SpaceGateComponent';

const { useSpaces, replace, pathname } = vi.hoisted(() => ({
  useSpaces: vi.fn(),
  replace: vi.fn(),
  pathname: { current: '/list' },
}));

vi.mock('../hooks/useSpaces', () => ({ useSpaces }));
vi.mock('../hooks/useCreateSpace', () => ({ useCreateSpace: () => ({ mutateAsync: vi.fn() }) }));
vi.mock('@/shared/services/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { name: 'Sam Lee' } } }) } }));
// The live connection has its own tests; here it only wraps the screen.
vi.mock('./SpacePresenceProviderComponent', () => ({ SpacePresenceProviderComponent: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => pathname.current,
  useSearchParams: () => new URLSearchParams(),
}));

const spaceWith = (tool: string) => ({
  id: 's',
  parentId: null,
  kind: 'space',
  title: 'S',
  tool,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'me',
  ownerName: null,
});

it.each([
  ['a notebook opened on the List screen', 'notebook', '/list', '/notebook?space=s'],
  ['a List space opened on the Notebook screen', 'list', '/notebook', '/list?space=s'],
])('sends %s to its own screen', (_, tool, path, target) => {
  vi.clearAllMocks();
  pathname.current = path;
  useSpaces.mockReturnValue({ data: [spaceWith(tool)], isPending: false, isError: false });
  renderGate();
  expect(replace).toHaveBeenCalledWith(target);
  expect(screen.queryByText('tool screen')).not.toBeInTheDocument();
  pathname.current = '/list';
});

const renderGate = () => render(<SpaceGateComponent>tool screen</SpaceGateComponent>);

beforeEach(() => vi.clearAllMocks());

it('welcomes someone with no spaces instead of asking for one', () => {
  useSpaces.mockReturnValue({ data: [], isPending: false, isError: false });
  renderGate();
  expect(screen.getByRole('heading', { name: 'Welcome to Daybook' })).toBeInTheDocument();
  expect(screen.getByText(/Hi Sam/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(screen.queryByText('tool screen')).not.toBeInTheDocument();
});

it('opens every tool from Browse tools', async () => {
  useSpaces.mockReturnValue({ data: [], isPending: false, isError: false });
  renderGate();
  await userEvent.click(screen.getByRole('button', { name: 'Browse tools' }));
  expect(screen.getByRole('dialog', { name: 'Browse tools' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Budget/ })).toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toBeInTheDocument();
});

it('shows the welcome page when only folders exist', () => {
  useSpaces.mockReturnValue({
    data: [{ id: 'f', parentId: null, kind: 'folder', title: 'F', tool: null, createdAt: '', openToday: 0 }],
    isPending: false,
    isError: false,
  });
  renderGate();
  expect(screen.getByRole('heading', { name: 'Welcome to Daybook' })).toBeInTheDocument();
});

it('shows the tool screen once a space exists', () => {
  useSpaces.mockReturnValue({
    data: [{ id: 's', parentId: null, kind: 'space', title: 'S', tool: 'list', createdAt: '', openToday: 0 }],
    isPending: false,
    isError: false,
  });
  renderGate();
  expect(screen.getByText('tool screen')).toBeInTheDocument();
});

it('shows a skeleton while loading', () => {
  useSpaces.mockReturnValue({ data: undefined, isPending: true, isError: false });
  renderGate();
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText('tool screen')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});

it('reports a load failure instead of the first-space page', () => {
  useSpaces.mockReturnValue({ data: undefined, isPending: false, isError: true });
  renderGate();
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load your spaces');
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});
