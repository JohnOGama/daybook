import { copyTitle } from '@/shared/utils/copy-title';
import type { Task, TaskStatus } from './task-types';

type DayRange = { from: string; to: string };
type TaskFieldChanges = Partial<Pick<Task, 'title' | 'status' | 'highPriority'>>;
type NewTaskFields = { id: string; title: string; status: TaskStatus; highPriority: boolean };

const notBefore = (day: string, today: string) => (day < today ? today : day);

const withSubtaskDays = (task: Task): Task => ({
  ...task,
  subtasks: task.subtasks.map((subtask) => ({ ...subtask, day: task.day })),
});

const finish = (task: Task, today: string): Task =>
  task.finished ? task : withSubtaskDays({ ...task, finished: true, completedOn: today, day: today });

const finishSubtask = (subtask: Task, today: string): Task =>
  subtask.finished ? subtask : { ...subtask, finished: true, completedOn: today };

const reopen = (task: Task, today: string): Task =>
  task.finished
    ? withSubtaskDays({
        ...task,
        finished: false,
        completedOn: null,
        status: 'todo',
        day: notBefore(task.plannedDay ?? today, today),
      })
    : task;

const reopenSubtask = (subtask: Task): Task =>
  subtask.finished ? { ...subtask, finished: false, completedOn: null, status: 'todo' } : subtask;

export function findFamily(tasks: Task[], id: string): Task | undefined {
  return tasks.find((task) => task.id === id || task.subtasks.some((subtask) => subtask.id === id));
}

export function upsertTask(tasks: Task[], range: DayRange, next: Task): Task[] {
  const exists = tasks.some((task) => task.id === next.id);
  if (next.day < range.from || next.day > range.to) {
    return exists ? tasks.filter((task) => task.id !== next.id) : tasks;
  }
  return exists ? tasks.map((task) => (task.id === next.id ? next : task)) : [...tasks, next];
}

export function withFields(family: Task, id: string, fields: TaskFieldChanges): Task {
  if (family.id === id) return { ...family, ...fields };
  return {
    ...family,
    subtasks: family.subtasks.map((subtask) => (subtask.id === id ? { ...subtask, ...fields } : subtask)),
  };
}

export function withFinished(family: Task, id: string, finished: boolean, today: string): Task {
  if (family.id === id) {
    return finished
      ? finish({ ...family, subtasks: family.subtasks.map((subtask) => finishSubtask(subtask, today)) }, today)
      : reopen({ ...family, subtasks: family.subtasks.map(reopenSubtask) }, today);
  }
  const subtasks = family.subtasks.map((subtask) => {
    if (subtask.id !== id) return subtask;
    return finished ? finishSubtask(subtask, today) : reopenSubtask(subtask);
  });
  const next = { ...family, subtasks };
  if (!finished) return reopen(next, today);
  return subtasks.every((subtask) => subtask.finished) ? finish(next, today) : next;
}

export function withDay(family: Task, day: string, today: string): Task {
  return withSubtaskDays({ ...family, plannedDay: day, day: notBefore(day, today) });
}

export function withSubtask(family: Task, subtask: Task, today: string): Task {
  return reopen({ ...family, subtasks: [...family.subtasks, subtask] }, today);
}

export function withoutSubtask(family: Task, id: string, today: string): Task {
  const subtasks = family.subtasks.filter((subtask) => subtask.id !== id);
  const next = { ...family, subtasks };
  return subtasks.length > 0 && subtasks.every((subtask) => subtask.finished) ? finish(next, today) : next;
}

export function buildTask(fields: NewTaskFields & { day: string }, today: string): Task {
  return {
    id: fields.id,
    parentId: null,
    title: fields.title.trim(),
    status: fields.status,
    highPriority: fields.highPriority,
    finished: false,
    day: notBefore(fields.day, today),
    plannedDay: fields.day,
    completedOn: null,
    createdAt: new Date().toISOString(),
    subtasks: [],
  };
}

export function buildSubtask(fields: NewTaskFields, parent: Task): Task {
  return {
    id: fields.id,
    parentId: parent.id,
    title: fields.title.trim(),
    status: fields.status,
    highPriority: fields.highPriority,
    finished: false,
    day: parent.day,
    plannedDay: null,
    completedOn: null,
    createdAt: new Date().toISOString(),
    subtasks: [],
  };
}

export function buildCopy(
  family: Task,
  newIds: Record<string, string>,
  sameSpace: boolean,
  today: string,
): Task {
  const createdAt = new Date().toISOString();
  const day = notBefore(family.day, today);
  const unfinished = (task: Task): Task => ({
    ...task,
    id: newIds[task.id],
    status: task.finished ? 'todo' : task.status,
    finished: false,
    completedOn: null,
    day,
    createdAt,
  });
  return {
    ...unfinished(family),
    title: sameSpace ? copyTitle(family.title) : family.title,
    plannedDay: family.day,
    subtasks: family.subtasks.map((subtask) => ({ ...unfinished(subtask), parentId: newIds[family.id] })),
  };
}
