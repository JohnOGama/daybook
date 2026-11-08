import type { Task, TaskStatus } from './task-types';

export type TaskFields = { title: string; status: TaskStatus; highPriority: boolean };
export type TaskChanges = Partial<TaskFields> & { day?: string };

async function send(url: string, method: string, body?: object): Promise<void> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error('That change could not be saved. Please try again.');
}

export async function fetchTasks(range: { from: string; to: string; today: string }): Promise<Task[]> {
  const response = await fetch(`/api/tasks?${new URLSearchParams(range)}`);
  if (!response.ok) throw new Error('Could not load tasks');
  return response.json();
}

export const createTask = (input: TaskFields & { day: string }) => send('/api/tasks', 'POST', input);

export const createSubtask = ({ parentId, input }: { parentId: string; input: TaskFields }) =>
  send(`/api/tasks/${parentId}/subtasks`, 'POST', input);

export const updateTask = ({ id, input }: { id: string; input: TaskChanges }) =>
  send(`/api/tasks/${id}`, 'PATCH', input);

export const setTaskFinished = (id: string, finished: boolean, today: string) =>
  send(`/api/tasks/${id}/finished`, 'PUT', { finished, today });

export const deleteTask = (id: string, today: string) =>
  send(`/api/tasks/${id}?${new URLSearchParams({ today })}`, 'DELETE');
