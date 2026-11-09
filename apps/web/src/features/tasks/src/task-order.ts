import type { Task } from './task-types';

export function moveId(ids: string[], activeId: string, overId: string): string[] {
  const next = [...ids];
  const [moved] = next.splice(next.indexOf(activeId), 1);
  next.splice(ids.indexOf(overId), 0, moved);
  return next;
}

export function siblingIds(tasks: Task[], id: string): string[] {
  const group = tasks.some((task) => task.id === id)
    ? tasks
    : (tasks.find((task) => task.subtasks.some((subtask) => subtask.id === id))?.subtasks ?? []);
  return group.map((task) => task.id);
}

function orderGroup(group: Task[], ranks: Map<string, number>): Task[] {
  if (!group.some((task) => ranks.has(task.id))) return group;
  const rank = (task: Task) => ranks.get(task.id) ?? Number.POSITIVE_INFINITY;
  return [...group].sort((a, b) => rank(a) - rank(b));
}

export function applyOrder(tasks: Task[], ids: string[]): Task[] {
  const ranks = new Map(ids.map((id, index) => [id, index]));
  return orderGroup(tasks, ranks).map((task) => ({ ...task, subtasks: orderGroup(task.subtasks, ranks) }));
}
