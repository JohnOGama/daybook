import type { Task } from './task-types';

export async function fetchTasks(range: { from: string; to: string; today: string }): Promise<Task[]> {
  const response = await fetch(`/api/tasks?${new URLSearchParams(range)}`);
  if (!response.ok) throw new Error('Could not load tasks');
  return response.json();
}
