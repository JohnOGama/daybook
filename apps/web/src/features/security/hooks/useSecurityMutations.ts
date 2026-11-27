'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addFinding, deleteFinding, scanTarget, updateFinding } from '../src/security-api';
import type { FindingChanges, FindingInput, FindingRow, ScanResult, SecurityView } from '../src/security-types';
import { useSecuritySpaceId } from './useSecurity';

// Optimistic like the rest of Daybook: patch the cache, roll back and toast on error.
export function useSecurityMutations() {
  const queryClient = useQueryClient();
  const spaceId = useSecuritySpaceId() as string;
  const key = ['security', spaceId];

  const writeView = (change: (view: SecurityView) => SecurityView) => queryClient.setQueryData<SecurityView>(key, (view) => view && change(view));
  const restore = (error: Error, previous: SecurityView | undefined) => {
    queryClient.setQueryData(key, previous);
    toast.error(error.message);
  };

  const add = useMutation({
    mutationFn: (input: FindingInput) => addFinding(spaceId, input),
    onMutate: (input: FindingInput) => {
      const previous = queryClient.getQueryData<SecurityView>(key);
      const now = new Date().toISOString();
      const row: FindingRow = { id: input.id, title: input.title, target: input.target ?? null, severity: input.severity, status: input.status ?? 'open', cvss: input.cvss ?? null, description: input.description ?? null, owasp: input.owasp ?? null, createdAt: now, updatedAt: now };
      writeView((view) => ({ ...view, findings: [row, ...view.findings] }));
      return previous;
    },
    onError: (error: Error, _input, previous) => restore(error, previous),
  });

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: FindingChanges }) => updateFinding(id, changes),
    onMutate: ({ id, changes }: { id: string; changes: FindingChanges }) => {
      const previous = queryClient.getQueryData<SecurityView>(key);
      writeView((view) => ({ ...view, findings: view.findings.map((f) => (f.id === id ? { ...f, ...changes } : f)) }));
      return previous;
    },
    onError: (error: Error, _vars, previous) => restore(error, previous),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFinding(id),
    onMutate: (id: string) => {
      const previous = queryClient.getQueryData<SecurityView>(key);
      writeView((view) => ({ ...view, findings: view.findings.filter((f) => f.id !== id) }));
      return previous;
    },
    onError: (error: Error, _id, previous) => restore(error, previous),
  });

  // The scan waits for the server, then prepends the findings it stored. Errors are toasted, not rolled back.
  const scan = useMutation({
    mutationFn: (url: string) => scanTarget(spaceId, url),
    onSuccess: (result: ScanResult) => {
      writeView((view) => ({ ...view, findings: [...result.findings, ...view.findings] }));
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { add, update, remove, scan };
}
