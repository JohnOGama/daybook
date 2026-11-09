import type { Task, TaskStatus } from './task-types';

export type TaskFields = { title: string; status: TaskStatus; highPriority: boolean };
export type NewTaskFields = TaskFields & { id: string };
export type TaskChanges = Partial<TaskFields> & { day?: string };

async function send(url: string, method: string, body?: object): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error('That change could not be saved. Please try again.');
}

export async function fetchTasks(range: {
  spaceId: string;
  from: string;
  to: string;
  today: string;
}): Promise<Task[]> {
  const response = await fetch(`/api/tasks?${new URLSearchParams(range)}`);
  if (!response.ok) throw new Error('Could not load tasks');
  return response.json();
}

export const createTask = (input: NewTaskFields & { day: string; spaceId: string }) =>
  send('/api/tasks', 'POST', input);

export type NewTaskList = {
  spaceId: string;
  day: string;
  tasks: { id: string; title: string; subtasks: { id: string; title: string }[] }[];
};

export const createTasks = (input: NewTaskList) => send('/api/tasks/bulk', 'POST', input);

export const createSubtask =({ parentId, input }: { parentId: string; input: NewTaskFields }) =>
  send(`/api/tasks/${parentId}/subtasks`, 'POST', input);

export const createSubtasks = ({
  parentId,
  subtasks,
}: {
  parentId: string;
  subtasks: { id: string; title: string }[];
}) => send(`/api/tasks/${parentId}/subtasks/bulk`, 'POST', { subtasks });

export const updateTask =({ id, input }: { id: string; input: TaskChanges }) =>
  send(`/api/tasks/${id}`, 'PATCH', input);

export const setTaskFinished = (id: string, finished: boolean, today: string, status?: TaskStatus) =>
  send(`/api/tasks/${id}/finished`, 'PUT', { finished, today, status });

export const copyTask = (id: string, today: string, spaceId?: string, newIds?: Record<string, string>) =>
  send(`/api/tasks/${id}/copy`, 'POST', { today, spaceId, newIds });

export const reorderTasks = (ids: string[]) => send('/api/tasks/order', 'PUT', { ids });

export const deleteTasks = (ids: string[]) => send('/api/tasks/bulk-delete', 'POST', { ids });

export const deleteTask =(id: string, today: string) =>
  send(`/api/tasks/${id}?${new URLSearchParams({ today })}`, 'DELETE');
