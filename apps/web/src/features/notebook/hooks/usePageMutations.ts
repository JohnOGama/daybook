'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActiveSpace } from '@/features/spaces';
import type { NotebookPage, PageChanges } from '../src/page-types';
import { createPage, deletePage, reorderPages, updatePage } from '../src/pages-api';

// Runs page requests one at a time, so typing in a new page can't reach the server before the page exists.
const scope = { id: 'notebook-pages' };

export function usePageMutations() {
  const queryClient = useQueryClient();
  const space = useActiveSpace();
  const spaceId = space?.id as string;
  const addsAtEnd = space?.tool === 'book';
  const key = ['pages', spaceId];

  const writePages = (change: (pages: NotebookPage[]) => NotebookPage[]) =>
    queryClient.setQueryData<NotebookPage[]>(key, (pages) => pages && change(pages));

  const patchPage = (id: string, changes: PageChanges) =>
    writePages((pages) => pages.map((page) => (page.id === id ? { ...page, ...changes } : page)));

  const addPage = useMutation({
    scope,
    mutationFn: ({ page }: { page: NotebookPage }) => createPage({ id: page.id, spaceId }),
    onMutate: ({ page }) => {
      writePages((pages) => (addsAtEnd ? [...pages, page] : [page, ...pages]));
    },
    onError: (error: Error, { page }) => {
      writePages((pages) => pages.filter(({ id }) => id !== page.id));
      toast.error(error.message);
    },
  });

  const save = useMutation({
    scope,
    mutationFn: updatePage,
    retry: 2,
    onMutate: () => queryClient.cancelQueries({ queryKey: ['pages'] }),
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const remove = useMutation({
    scope,
    mutationFn: deletePage,
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<NotebookPage[]>(key);
      writePages((pages) => pages.filter((page) => page.id !== id));
      return previous;
    },
    onError: (error: Error, _id, previous) => {
      queryClient.setQueryData(key, previous);
      toast.error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['trash'] }),
  });

  const reorder = useMutation({
    scope,
    mutationFn: (ids: string[]) => reorderPages({ spaceId, ids }),
    onMutate: (ids) => {
      const previous = queryClient.getQueryData<NotebookPage[]>(key);
      writePages((pages) => [...pages].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
      return previous;
    },
    onError: (error: Error, _ids, previous) => {
      queryClient.setQueryData(key, previous);
      toast.error(error.message);
    },
  });

  function create() {
    const page: NotebookPage = { id: crypto.randomUUID(), title: '', content: null, createdAt: new Date().toISOString() };
    addPage.mutate({ page });
    return page.id;
  }

  return { create, save, remove, reorder, patchPage };
}
