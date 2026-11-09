'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageChanges } from '../src/page-types';
import { usePageMutations } from './usePageMutations';

export type SaveStatus = 'saved' | 'saving' | 'failed';

const SAVE_DELAY_MS = 600;

// ponytail: last write wins if one page is edited in two tabs; add version checks if that becomes real
export function usePageAutosave(pageId: string) {
  const { save, patchPage } = usePageMutations();
  const { mutate } = save;
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pending = useRef<PageChanges>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const changes = pending.current;
    if (Object.keys(changes).length === 0) return;
    pending.current = {};
    setStatus('saving');
    mutate(
      { id: pageId, changes },
      {
        onSuccess: () => {
          if (Object.keys(pending.current).length === 0) setStatus('saved');
        },
        onError: () => {
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
    pending.current = { ...pending.current, ...changes };
    patchPage(pageId, changes);
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  return { schedule, status };
}
