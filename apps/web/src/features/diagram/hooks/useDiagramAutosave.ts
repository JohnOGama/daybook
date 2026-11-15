'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConflictError } from '@/shared/utils/conflict-error';
import { type Diagram, saveDiagram } from '../src/diagram-api';
import type { Positions } from '../src/diagram-types';

const PAUSE_MS = 800;

type Draft = { dbml: string; positions: Positions };
export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';

// Shows every change straight away and sends the latest one once typing or dragging pauses.
// `version` is the diagram's version when the workspace opened; only this workspace's own saves move it after that,
// so a background refetch can't make stale text look up to date.
export function useDiagramAutosave(spaceId: string | undefined, version: number) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pending = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const base = useRef(version);
  const sending = useRef(false);
  const conflicted = useRef(false);

  // One save at a time, each naming the version the one before it returned. A save in flight sends what is pending when it ends.
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (sending.current || !spaceId) return;
    sending.current = true;
    try {
      while (pending.current && !conflicted.current) {
        const draft = pending.current;
        pending.current = null;
        setStatus('saving');
        const saved = await saveDiagram({ spaceId, ...draft, version: base.current });
        base.current = saved.version;
        queryClient.setQueryData<Diagram>(['diagram', spaceId], (old) => (old ? { ...old, version: saved.version } : old));
      }
      if (!conflicted.current) setStatus('saved');
    } catch (error) {
      if (error instanceof ConflictError) {
        conflicted.current = true;
        pending.current = null;
        setStatus('conflict');
      } else {
        setStatus('error');
        toast.error((error as Error).message);
      }
    } finally {
      sending.current = false;
    }
  }, [queryClient, spaceId]);

  const queue = useCallback(
    (draft: Draft) => {
      if (conflicted.current) return;
      queryClient.setQueryData<Diagram>(['diagram', spaceId], (old) => (old ? { ...old, ...draft } : old));
      pending.current = draft;
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, PAUSE_MS);
    },
    [queryClient, spaceId, flush],
  );

  // Drops unsaved changes and loads the saved diagram; the page then reopens the workspace on it.
  const reload = useCallback(async () => {
    clearTimeout(timer.current);
    pending.current = null;
    await queryClient.invalidateQueries({ queryKey: ['diagram', spaceId] });
    base.current = queryClient.getQueryData<Diagram>(['diagram', spaceId])?.version ?? base.current;
    conflicted.current = false;
    setStatus('saved');
  }, [queryClient, spaceId]);

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [flush]);

  return { status, queue, flush, reload };
}
