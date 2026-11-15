import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { ChapterOutlineComponent } from '@/features/book/src/ChapterOutlineComponent';
import { PageEditorComponent } from './PageEditorComponent';
import { PageHistoryComponent } from './PageHistoryComponent';
import { PageListComponent } from './PageListComponent';
import type { NotebookPage } from './page-types';

vi.mock('@/features/spaces', () => ({ useActiveSpace: () => undefined, ViewOnlyBadgeComponent: () => null }));
const schedule = vi.fn();
vi.mock('../hooks/usePageAutosave', () => ({ usePageAutosave: () => ({ schedule, status: 'saved', reload: vi.fn() }) }));
vi.mock('../hooks/usePageMutations', () => ({
  usePageMutations: () => ({ create: vi.fn(), remove: { mutate: vi.fn() }, reorder: { mutate: vi.fn() } }),
}));
vi.mock('../hooks/usePageVersions', () => ({
  usePageVersions: () => ({ isPending: false, isError: false, data: [{ id: 'v1', createdAt: '2026-01-01T09:00:00Z' }] }),
  usePageVersion: () => ({
    isPending: false,
    isError: false,
    data: { id: 'v1', createdAt: '', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Old' }] }] } },
  }),
}));

const page: NotebookPage = {
  id: 'p1',
  title: 'Launch notes',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] },
  createdAt: '',
  version: 1,
};
const pages = [page, { ...page, id: 'p2', title: 'Other' }];
const wrap = (ui: ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

it('a viewer gets a page they can read but not type into', async () => {
  render(wrap(<PageEditorComponent page={page} canEdit={false} improveWithAi />));
  expect(screen.getByRole('heading', { name: 'Launch notes' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Page title' })).not.toBeInTheDocument();
  const content = await screen.findByLabelText('Page content');
  expect(content).toHaveAttribute('contenteditable', 'false');
  expect(screen.getByRole('button', { name: 'Version history' })).toBeEnabled();
  expect(schedule).not.toHaveBeenCalled();
});

it('a viewer can read the history but not restore from it', () => {
  const editor = { getJSON: () => ({ type: 'doc', content: [] }) } as never;
  render(wrap(<PageHistoryComponent pageId="p1" editor={editor} open onOpenChange={() => {}} canEdit={false} />));
  expect(screen.getByRole('list', { name: 'Versions' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument();
});

it('a viewer gets a page list with no add, reorder or delete', async () => {
  render(<PageListComponent pages={pages} isPending={false} hrefOf={(id) => `/n?page=${id}`} onAddPage={() => {}} canEdit={false} />);
  expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(2);
  await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Launch notes') });
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
});

it('a viewer gets a chapter outline with no add, reorder or delete', async () => {
  render(
    <ChapterOutlineComponent chapters={pages} isPending={false} chapterHref={(id) => `/b?page=${id}`} readHref="/b" onAddChapter={() => {}} canEdit={false} />,
  );
  expect(screen.queryByRole('button', { name: 'Add chapter' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reorder/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Read' })).toBeInTheDocument();
  await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Launch notes') });
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
});
