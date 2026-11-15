'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActiveSpace } from '@/features/spaces';
import { ConflictError } from '@/shared/utils/conflict-error';
import type { NotebookPage, PageChanges } from '../src/page-types';
import { createPage, deletePage, reorderPages, updatePage } from '../src/pages-api';

// Runs page requests one at a time, so typing in a new page can't reach the server before the page exists.
const scope = { id: 'notebook-pages' };

// `base` is the version the editor's content was edited from. It is read when the request actually starts,
// so a save queued behind another sends the version that one returned.
type Save = { id: string; changes: PageChanges; base: { current: number } };

export function usePageMutations() {
  const queryClient = useQueryClient();
  const space = useActiveSpace();
  const spaceId = space?.id as string;
  const addsAtEnd = space?.tool === 'book';
  const key = ['pages', spaceId];

  const writePages = (change: (pages: NotebookPage[]) => NotebookPage[]) =>
    queryClient.setQueryData<NotebookPage[]>(key, (pages) => pages && change(pages));

  const patchPage = (id: string, changes: Partial<Omit<NotebookPage, 'id'>>) =>
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
    mutationFn: ({ id, changes, base }: Save) =>
      updatePage({ id, changes: changes.content === undefined ? changes : { ...changes, version: base.current } }),
    retry: (failures, error) => !(error instanceof ConflictError) && failures < 2,
    onMutate: () => queryClient.cancelQueries({ queryKey: ['pages'] }),
    // A title-only save returns whatever version is current, which may be newer than this editor's content.
    onSuccess: ({ version }, { id, changes, base }) => {
      if (changes.content === undefined) return;
      base.current = version;
      patchPage(id, { version });
    },
    onError: (error: Error) => {
      if (!(error instanceof ConflictError)) toast.error(error.message);
    },
  });

  async function reloadPage(id: string) {
    await queryClient.invalidateQueries({ queryKey: key });
    return queryClient.getQueryData<NotebookPage[]>(key)?.find((page) => page.id === id);
  }

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
    const page: NotebookPage = { id: crypto.randomUUID(), title: '', content: null, createdAt: new Date().toISOString(), version: 0 };
    addPage.mutate({ page });
    return page.id;
  }

  return { create, save, remove, reorder, patchPage, reloadPage };
}
