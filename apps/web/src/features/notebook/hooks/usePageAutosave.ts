'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConflictError } from '@/shared/utils/conflict-error';
import type { PageChanges } from '../src/page-types';
import { usePageMutations } from './usePageMutations';

export type SaveStatus = 'saved' | 'saving' | 'failed' | 'conflict';

const SAVE_DELAY_MS = 600;

// `version` is the page's version when the editor opened. Afterwards only this editor's own content saves move it,
// so a background refetch can't make a stale editor look up to date.
export function usePageAutosave(pageId: string, version: number) {
  const { save, patchPage, reloadPage } = usePageMutations();
  const { mutate } = save;
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pending = useRef<PageChanges>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const base = useRef(version);
  const conflicted = useRef(false);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const changes = pending.current;
    if (conflicted.current || Object.keys(changes).length === 0) return;
    pending.current = {};
    setStatus('saving');
    mutate(
      { id: pageId, changes, base },
      {
        onSuccess: () => {
          if (Object.keys(pending.current).length === 0) setStatus('saved');
        },
        onError: (error) => {
          if (error instanceof ConflictError) {
            conflicted.current = true;
            pending.current = {};
            setStatus('conflict');
            return;
          }
          pending.current = { ...changes, ...pending.current };
          setStatus('failed');
        },
      },
    );
  }, [pageId, mutate]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  function schedule(changes: PageChanges) {
    if (conflicted.current) return;
    pending.current = { ...pending.current, ...changes };
    patchPage(pageId, changes);
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  // Drops this editor's unsaved changes and returns the page as it is now saved, for the editor to show.
  async function reload() {
    clearTimeout(timer.current);
    pending.current = {};
    const page = await reloadPage(pageId);
    if (page) base.current = page.version;
    conflicted.current = false;
    setStatus('saved');
    return page;
  }

  return { schedule, status, reload };
}
