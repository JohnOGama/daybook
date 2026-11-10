import type { Task } from './task-types';

const flatten = (tasks: Task[]): Task[] => tasks.flatMap((task) => [task, ...flatten(task.subtasks)]);

export function daySummary(tasks: Task[]) {
  const all = flatten(tasks);
  const done = all.filter((task) => task.finished).length;
  return {
    total: all.length,
    done,
    percent: all.length === 0 ? 0 : Math.round((done / all.length) * 100),
    highLeft: all.filter((task) => !task.finished && task.highPriority).length,
  };
}

export const openTaskCount = (tasks: Task[]) => tasks.filter((task) => !task.finished).length;

export function sidebarCounts(tasks: Task[]) {
  const open = flatten(tasks).filter((task) => !task.finished);
  const withStatus = (status: Task['status']) => open.filter((task) => task.status === status).length;
  return {
    todo: withStatus('todo'),
    inProgress: withStatus('in_progress'),
    onHold: withStatus('on_hold'),
    high: open.filter((task) => task.highPriority).length,
  };
}
