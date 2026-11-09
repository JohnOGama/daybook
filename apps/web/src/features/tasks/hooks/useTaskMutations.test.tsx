import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../src/task-types';
import { useTaskMutations } from './useTaskMutations';

const api = vi.hoisted(() => ({
  copyTask: vi.fn(),
  createSubtask: vi.fn(),
  createSubtasks: vi.fn(),
  createTask: vi.fn(),
  createTasks: vi.fn(),
  deleteTask: vi.fn(),
  deleteTasks: vi.fn(),
  reorderTasks: vi.fn(),
  setTaskFinished: vi.fn(),
  updateTask: vi.fn(),
}));
const { toastError, toastSuccess } = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

vi.mock('../src/tasks-api', () => api);
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1' }) }));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-09' }));

const today = '2026-11-09';
const todayKey = ['tasks', 's1', today, today, today];
const futureKey = ['tasks', 's1', '2026-11-20', '2026-11-20', today];

function task(id: string, fields: Partial<Task> = {}): Task {
  return {
    id,
    parentId: null,
    title: id,
    status: 'todo',
    highPriority: false,
    finished: false,
    day: today,
    plannedDay: today,
    completedOn: null,
    createdAt: '',
    subtasks: [],
    ...fields,
  };
}

function never() {
  return new Promise<void>(() => {});
}

describe('useTaskMutations', () => {
  let client: QueryClient;
  const cached = (key = todayKey) => client.getQueryData<Task[]>(key) ?? [];
  const setup = () =>
    renderHook(() => useTaskMutations(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    }).result;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of Object.values(api)) fn.mockResolvedValue(undefined);
    client = new QueryClient();
    client.setQueryData(todayKey, [task('a'), task('b')]);
    client.setQueryData(futureKey, []);
    client.setQueryData(['spaces', today], [{ id: 's1', kind: 'space', openToday: 2 }]);
  });

  it('ticks a task before the server replies', async () => {
    api.setTaskFinished.mockReturnValue(never());
    const result = setup();
    act(() => result.current.setFinished.mutate({ id: 'a', finished: true }));
    await waitFor(() => expect(cached()[0].finished).toBe(true));
  });

  it('updates the sidebar count before the server replies', async () => {
    api.setTaskFinished.mockReturnValue(never());
    const result = setup();
    act(() => result.current.setFinished.mutate({ id: 'a', finished: true }));
    await waitFor(() =>
      expect(client.getQueryData<{ openToday: number }[]>(['spaces', today])?.[0].openToday).toBe(1),
    );
  });

  it('does not refetch tasks after a successful change', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const result = setup();
    await act(() => result.current.setFinished.mutateAsync({ id: 'a', finished: true }));
    expect(invalidate).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['tasks'] }));
  });

  it('puts everything back and reports when the server refuses', async () => {
    api.setTaskFinished.mockRejectedValue(new Error('nope'));
    const result = setup();
    await act(async () => {
      await result.current.setFinished.mutateAsync({ id: 'a', finished: true }).catch(() => {});
    });
    expect(cached()[0].finished).toBe(false);
    expect(client.getQueryData<{ openToday: number }[]>(['spaces', today])?.[0].openToday).toBe(2);
    expect(toastError).toHaveBeenCalledWith('nope');
  });

  it('shows a new task at once and sends the same id to the server', async () => {
    api.createTask.mockReturnValue(never());
    const result = setup();
    act(() => {
      void result.current.create.mutateAsync({ title: 'New', day: today, status: 'todo', highPriority: false });
    });
    await waitFor(() => expect(cached().map((t) => t.title)).toEqual(['a', 'b', 'New']));
    expect(api.createTask.mock.calls[0][0]).toMatchObject({ id: cached()[2].id, spaceId: 's1' });
  });

  it('confirms a new task only once the server accepts it', async () => {
    const input = { title: 'New', day: today, status: 'todo' as const, highPriority: false };
    const result = setup();
    api.createTask.mockRejectedValueOnce(new Error('nope'));
    await act(async () => {
      await result.current.create.mutateAsync(input).catch(() => {});
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    await act(() => result.current.create.mutateAsync(input));
    expect(toastSuccess).toHaveBeenCalledWith('Created "New"');
  });

  it('shows a pasted list at once and sends the same ids', async () => {
    api.createTasks.mockReturnValue(never());
    const result = setup();
    act(() => {
      void result.current.createMany.mutateAsync({
        day: today,
        list: [
          { title: 'One', subtasks: [{ title: 'Under one', subtasks: [] }] },
          { title: 'Two', subtasks: [] },
        ],
      });
    });
    await waitFor(() => expect(cached().map((t) => t.title)).toEqual(['a', 'b', 'One', 'Two']));
    const [, , one] = cached();
    expect(one.subtasks[0]).toMatchObject({ title: 'Under one', parentId: one.id, day: today });
    expect(api.createTasks.mock.calls[0][0]).toMatchObject({
      spaceId: 's1',
      tasks: [{ id: one.id, subtasks: [{ id: one.subtasks[0].id }] }, { title: 'Two' }],
    });
    expect(client.getQueryData<{ openToday: number }[]>(['spaces', today])?.[0].openToday).toBeGreaterThan(2);
  });

  it('clears the table at once and brings it back if the server refuses', async () => {
    api.deleteTasks.mockReturnValueOnce(never());
    const result = setup();
    act(() => result.current.removeMany.mutate(['a', 'b']));
    await waitFor(() => expect(cached()).toEqual([]));

    client.setQueryData(todayKey, [task('a'), task('b')]);
    api.deleteTasks.mockRejectedValueOnce(new Error('nope'));
    await act(async () => {
      await result.current.removeMany.mutateAsync(['a', 'b']).catch(() => {});
    });
    expect(cached().map((t) => t.id)).toEqual(['a', 'b']);
    expect(toastError).toHaveBeenCalledWith('nope');
  });

  it('shows pasted subtasks at once and sends the same ids', async () => {
    api.createSubtasks.mockReturnValue(never());
    const result = setup();
    act(() => {
      void result.current.createManySubtasks.mutateAsync({
        parentId: 'a',
        list: [
          { title: 'One', subtasks: [{ title: 'Under one', subtasks: [] }] },
          { title: 'Two', subtasks: [] },
        ],
      });
    });
    await waitFor(() => expect(cached()[0].subtasks.map((t) => t.title)).toEqual(['One', 'Two']));
    const [one] = cached()[0].subtasks;
    expect(one).toMatchObject({ parentId: 'a', day: today, finished: false });
    expect(one.subtasks[0]).toMatchObject({ title: 'Under one', parentId: one.id, day: today });
    expect(api.createSubtasks.mock.calls[0][0]).toMatchObject({
      parentId: 'a',
      subtasks: [{ id: one.id, subtasks: [{ id: one.subtasks[0].id }] }, { title: 'Two' }],
    });
  });

  it('adds a subtask under a subtask at once', async () => {
    client.setQueryData(todayKey, [task('a', { subtasks: [task('child', { parentId: 'a', plannedDay: null })] })]);
    api.createSubtask.mockReturnValue(never());
    const result = setup();
    act(() => {
      void result.current.createSubtask.mutateAsync({
        parentId: 'child',
        input: { title: 'Deep', status: 'todo', highPriority: false },
      });
    });
    await waitFor(() => expect(cached()[0].subtasks[0].subtasks[0]?.title).toBe('Deep'));
    expect(cached()[0].subtasks[0].subtasks[0].parentId).toBe('child');
  });

  it('removes a task at once', async () => {
    api.deleteTask.mockReturnValue(never());
    const result = setup();
    act(() => result.current.remove.mutate('a'));
    await waitFor(() => expect(cached().map((t) => t.id)).toEqual(['b']));
  });

  it('reorders at once', async () => {
    api.reorderTasks.mockReturnValue(never());
    const result = setup();
    act(() => result.current.reorder.mutate(['b', 'a']));
    await waitFor(() => expect(cached().map((t) => t.id)).toEqual(['b', 'a']));
  });

  it('renames at once', async () => {
    api.updateTask.mockReturnValue(never());
    const result = setup();
    act(() => result.current.update.mutate({ id: 'a', input: { title: 'Renamed' } }));
    await waitFor(() => expect(cached()[0].title).toBe('Renamed'));
  });

  it('moves a task between cached days at once', async () => {
    api.updateTask.mockReturnValue(never());
    const result = setup();
    act(() => result.current.update.mutate({ id: 'a', input: { day: '2026-11-20' } }));
    await waitFor(() => expect(cached(futureKey).map((t) => t.id)).toEqual(['a']));
    expect(cached().map((t) => t.id)).toEqual(['b']);
  });

  it('shows a duplicate at once and sends the same ids', async () => {
    api.copyTask.mockReturnValue(never());
    const result = setup();
    act(() => result.current.copy.mutate({ id: 'a' }));
    await waitFor(() => expect(cached().map((t) => t.title)).toEqual(['a', 'b', 'a (copy)']));
    const [, , , newIds] = api.copyTask.mock.calls[0];
    expect(newIds.a).toBe(cached()[2].id);
  });
});
