'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConflictError, type EditedFrom } from '@/shared/utils/conflict-error';
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
  const from = useRef<EditedFrom>({ version, conflicted: false }).current;

  const showConflict = useCallback(() => {
    from.conflicted = true;
    pending.current = {};
    setStatus('conflict');
  }, [from]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const changes = pending.current;
    if (from.conflicted || Object.keys(changes).length === 0) return;
    pending.current = {};
    setStatus('saving');
    // These callbacks run only for the latest save, so each checks `from` for a refusal of one queued ahead of it.
    mutate(
      { id: pageId, changes, from },
      {
        onSuccess: () => {
          if (from.conflicted) showConflict();
          else if (Object.keys(pending.current).length === 0) setStatus('saved');
        },
        onError: (error) => {
          if (from.conflicted || error instanceof ConflictError) return showConflict();
          pending.current = { ...changes, ...pending.current };
          setStatus('failed');
        },
      },
    );
  }, [pageId, mutate, from, showConflict]);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  function schedule(changes: PageChanges) {
    if (from.conflicted) return;
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
    if (page) from.version = page.version;
    from.conflicted = false;
    setStatus('saved');
    return page;
  }

  return { schedule, status, reload };
}
