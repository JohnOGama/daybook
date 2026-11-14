'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type Diagram, saveDiagram } from '../src/diagram-api';
import type { Positions } from '../src/diagram-types';

const PAUSE_MS = 800;

type Draft = { dbml: string; positions: Positions };
export type SaveStatus = 'saved' | 'saving' | 'error';

// Shows every change straight away and sends the latest one once typing or dragging pauses.
export function useDiagramAutosave(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const pending = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const draft = pending.current;
    if (!draft || !spaceId) return;
    pending.current = null;
    setStatus('saving');
    try {
      await saveDiagram({ spaceId, ...draft });
      setStatus(pending.current ? 'saving' : 'saved');
    } catch (error) {
      setStatus('error');
      toast.error((error as Error).message);
    }
  }, [spaceId]);

  const queue = useCallback(
    (draft: Draft) => {
      queryClient.setQueryData<Diagram>(['diagram', spaceId], (old) => (old ? { ...old, ...draft } : old));
      pending.current = draft;
      setStatus('saving');
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, PAUSE_MS);
    },
    [queryClient, spaceId, flush],
  );

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [flush]);

  return { status, queue, flush };
}
