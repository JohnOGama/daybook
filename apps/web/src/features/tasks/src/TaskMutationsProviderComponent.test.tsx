import { render } from '@testing-library/react';
import { memo, useContext } from 'react';
import { expect, it, vi } from 'vitest';
import { type TaskMutations, TaskMutationsContext } from '../hooks/useTaskMutations';
import { TaskMutationsProviderComponent } from './TaskMutationsProviderComponent';

const { current } = vi.hoisted(() => ({ current: { mutations: {} as object } }));

vi.mock('../hooks/useTaskMutations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useTaskMutations')>()),
  useCreateTaskMutations: () => current.mutations,
}));

const seen: TaskMutations[] = [];
const Consumer = memo(function Consumer() {
  const mutations = useContext(TaskMutationsContext);
  if (mutations) seen.push(mutations);
  return null;
});
const child = <Consumer />;

it('gives rows one unchanging object that always calls the latest action', () => {
  const first = vi.fn();
  const second = vi.fn();
  current.mutations = { remove: { mutate: first } };
  const { rerender } = render(<TaskMutationsProviderComponent>{child}</TaskMutationsProviderComponent>);

  current.mutations = { remove: { mutate: second } };
  rerender(<TaskMutationsProviderComponent>{child}</TaskMutationsProviderComponent>);

  expect(seen).toHaveLength(1);
  seen[0].remove.mutate('task-id');
  expect(second).toHaveBeenCalledWith('task-id');
  expect(first).not.toHaveBeenCalled();
});
