import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { SpaceGateComponent } from './SpaceGateComponent';

const { useSpaces, replace, pathname } = vi.hoisted(() => ({
  useSpaces: vi.fn(),
  replace: vi.fn(),
  pathname: { current: '/list' },
}));

vi.mock('../hooks/useSpaces', () => ({ useSpaces }));
vi.mock('../hooks/useCreateSpace', () => ({ useCreateSpace: () => ({ mutateAsync: vi.fn() }) }));
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

it('shows the blank first-space page when there are no spaces', () => {
  useSpaces.mockReturnValue({ data: [], isPending: false, isError: false });
  renderGate();
  expect(screen.getByRole('heading', { name: 'Create your first space' })).toBeInTheDocument();
  expect(screen.queryByText('tool screen')).not.toBeInTheDocument();
});

it('shows the first-space page when only folders exist', () => {
  useSpaces.mockReturnValue({
    data: [{ id: 'f', parentId: null, kind: 'folder', title: 'F', tool: null, createdAt: '', openToday: 0 }],
    isPending: false,
    isError: false,
  });
  renderGate();
  expect(screen.getByRole('heading', { name: 'Create your first space' })).toBeInTheDocument();
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
