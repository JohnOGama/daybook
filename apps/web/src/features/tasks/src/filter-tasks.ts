import type { Task, TaskFilters } from './task-types';

function matches(task: Task, filters: TaskFilters): boolean {
  return (
    !task.finished &&
    (filters.statuses.length === 0 || filters.statuses.includes(task.status)) &&
    (!filters.high || task.highPriority)
  );
}

export const sameTasks = (a: Task[], b: Task[]) => a.length === b.length && a.every((task, index) => task === b[index]);

const withSubtasks = (task: Task, subtasks: Task[]) => (sameTasks(subtasks, task.subtasks) ? task : { ...task, subtasks });

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  if (filters.statuses.length === 0 && !filters.high) return tasks;
  return tasks.flatMap((task) => {
    const subtasks = filterTasks(task.subtasks, filters);
    return matches(task, filters) || subtasks.length > 0 ? [withSubtasks(task, subtasks)] : [];
  });
}

export const withoutFinished = (tasks: Task[]): Task[] =>
  tasks.filter((task) => !task.finished).map((task) => withSubtasks(task, withoutFinished(task.subtasks)));
