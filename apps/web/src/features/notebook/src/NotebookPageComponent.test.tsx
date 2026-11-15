import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { NotebookPageComponent } from './NotebookPageComponent';
import type { NotebookPage } from './page-types';

const { usePages, create, replace, query } = vi.hoisted(() => ({
  usePages: vi.fn(),
  create: vi.fn(() => 'new-page'),
  replace: vi.fn(),
  query: { current: 'space=s1' },
}));

vi.mock('../hooks/usePages', () => ({ usePages }));
vi.mock('../hooks/usePageMutations', () => ({ usePageMutations: () => ({ create, remove: { mutate: vi.fn() } }) }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Work notes' }),
  useSpaceAccess: () => ({ canEdit: true }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query.current),
}));
vi.mock('./PageEditorComponent', () => ({
  PageEditorComponent: ({ page }: { page: NotebookPage }) => <p>Editing {page.title}</p>,
}));

const page = (id: string, title: string, text?: string): NotebookPage => ({
  id,
  title,
  content: text ? { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } : null,
  createdAt: '',
  version: 0,
});

const showPages = (pages: NotebookPage[]) => {
  usePages.mockReturnValue({ data: pages, isPending: false, isError: false });
  render(<NotebookPageComponent />);
};

beforeEach(() => {
  vi.clearAllMocks();
  query.current = 'space=s1';
});

it('puts the page it opens by default in the URL, so reordering cannot switch it', () => {
  showPages([page('a', 'Launch'), page('b', 'Plans')]);
  expect(replace).toHaveBeenCalledWith('/notebook?space=s1&page=a');
  vi.clearAllMocks();
  query.current = 'space=s1&page=a';
  usePages.mockReturnValue({ data: [page('b', 'Plans'), page('a', 'Launch')], isPending: false, isError: false });
  render(<NotebookPageComponent />);
  expect(screen.getAllByText('Editing Launch')).toHaveLength(2);
  expect(replace).not.toHaveBeenCalled();
});

it('lists the pages with a preview and opens the first one', () => {
  showPages([page('a', 'Launch', 'Get ready'), page('b', '')]);
  expect(screen.getByRole('link', { name: /Launch/ })).toHaveTextContent('Get ready');
  expect(screen.getByRole('link', { name: /Untitled/ })).toHaveTextContent('Empty page');
  expect(screen.getByText('Editing Launch')).toBeInTheDocument();
  expect(screen.getByText('2 pages')).toBeInTheDocument();
});

it('opens the page named in the address', () => {
  query.current = 'space=s1&page=b';
  showPages([page('a', 'Launch'), page('b', 'Handover')]);
  expect(screen.getByText('Editing Handover')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Handover/ })).toHaveAttribute('aria-current', 'page');
});

it('Add page creates a page and opens it', async () => {
  showPages([page('a', 'Launch')]);
  await userEvent.click(screen.getByRole('button', { name: 'Add page' }));
  expect(create).toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith('/notebook?space=s1&page=new-page');
});

it('offers to add the first page of an empty notebook', () => {
  showPages([]);
  expect(screen.getByRole('heading', { name: 'This notebook has no pages' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Add page' })).toHaveLength(2);
});

it('reports a load failure', () => {
  usePages.mockReturnValue({ data: undefined, isPending: false, isError: true });
  render(<NotebookPageComponent />);
  expect(screen.getByRole('alert')).toHaveTextContent('Could not load this notebook');
});
