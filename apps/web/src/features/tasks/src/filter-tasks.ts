import type { Task, TaskFilters } from './task-types';

function matches(task: Task, filters: TaskFilters): boolean {
  return (
    !task.finished &&
    (filters.statuses.length === 0 || filters.statuses.includes(task.status)) &&
    (!filters.high || task.highPriority)
  );
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  if (filters.statuses.length === 0 && !filters.high) return tasks;
  return tasks.flatMap((task) => {
    const subtasks = filterTasks(task.subtasks, filters);
    return matches(task, filters) || subtasks.length > 0 ? [{ ...task, subtasks }] : [];
  });
}
