'use client';

import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { type TaskMutations, TaskMutationsContext, useCreateTaskMutations } from '../hooks/useTaskMutations';

type AllMutations = ReturnType<typeof useCreateTaskMutations>;
type Action = (...args: unknown[]) => unknown;
type LooseMutation = { mutate?: Action; mutateAsync?: Action };

function stableActions(latest: RefObject<AllMutations>): TaskMutations {
  const current = (name: string) => (latest.current as unknown as Record<string, LooseMutation>)[name];
  return Object.fromEntries(
    Object.keys(latest.current).map((name) => [
      name,
      {
        mutate: (...args: unknown[]) => current(name).mutate?.(...args),
        mutateAsync: (...args: unknown[]) => current(name).mutateAsync?.(...args),
      },
    ]),
  ) as unknown as TaskMutations;
}

export function TaskMutationsProviderComponent({ children }: { children: ReactNode }) {
  const mutations = useCreateTaskMutations();
  const latest = useRef(mutations);
  const [stable] = useState(() => stableActions(latest));

  useLayoutEffect(() => {
    latest.current = mutations;
  });

  return <TaskMutationsContext value={stable}>{children}</TaskMutationsContext>;
}
