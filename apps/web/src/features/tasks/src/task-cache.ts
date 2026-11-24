import { copyTitle } from '@/shared/utils/copy-title';
import type { Task, TaskStatus } from './task-types';

type DayRange = { from: string; to: string };
type TaskFieldChanges = Partial<Pick<Task, 'title' | 'status' | 'highPriority' | 'dueDay'>>;
type NewTaskFields = { id: string; title: string; status: TaskStatus; highPriority: boolean; dueDay?: string | null };
export type NewPastedTask = { id: string; title: string; subtasks: NewPastedTask[] };

const shownDay = (day: string, today: string, carryOver: boolean) => (carryOver && day < today ? today : day);

const containsTask = (task: Task, id: string): boolean =>
  task.id === id || task.subtasks.some((subtask) => containsTask(subtask, id));

export const findTask = (task: Task, id: string): Task | undefined => {
  if (task.id === id) return task;
  for (const subtask of task.subtasks) {
    const found = findTask(subtask, id);
    if (found) return found;
  }
  return undefined;
};

export const allInTree = (task: Task): Task[] => [task, ...task.subtasks.flatMap(allInTree)];

const withTreeDay = (task: Task, day: string): Task => ({
  ...task,
  day,
  subtasks: task.subtasks.map((subtask) => withTreeDay(subtask, day)),
});

const finishOne = (task: Task, today: string): Task =>
  task.finished ? task : { ...task, finished: true, completedOn: today };

const reopenOne = (task: Task): Task =>
  task.finished ? { ...task, finished: false, completedOn: null, status: 'todo' } : task;

const finishTree = (task: Task, today: string): Task =>
  finishOne({ ...task, subtasks: task.subtasks.map((subtask) => finishTree(subtask, today)) }, today);

const reopenTree = (task: Task): Task =>
  reopenOne({ ...task, subtasks: task.subtasks.map(reopenTree) });

const allFinished = (subtasks: Task[]) => subtasks.length > 0 && subtasks.every((subtask) => subtask.finished);

function placedOnDay(before: Task, after: Task, today: string, carryOver: boolean): Task {
  if (after.finished === before.finished) return after;
  return withTreeDay(after, after.finished ? today : shownDay(after.plannedDay ?? today, today, carryOver));
}

export function findFamily(tasks: Task[], id: string): Task | undefined {
  return tasks.find((task) => containsTask(task, id));
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
  if (!containsTask(family, id)) return family;
  return { ...family, subtasks: family.subtasks.map((subtask) => withFields(subtask, id, fields)) };
}

function changeFinished(task: Task, id: string, finished: boolean, today: string): Task {
  if (task.id === id) return finished ? finishTree(task, today) : reopenTree(task);
  if (!containsTask(task, id)) return task;
  const next = { ...task, subtasks: task.subtasks.map((subtask) => changeFinished(subtask, id, finished, today)) };
  if (!finished) return reopenOne(next);
  return allFinished(next.subtasks) ? finishOne(next, today) : next;
}

export function withFinished(family: Task, id: string, finished: boolean, today: string, carryOver = true): Task {
  return placedOnDay(family, changeFinished(family, id, finished, today), today, carryOver);
}

export function withDay(family: Task, day: string, today: string, carryOver = true): Task {
  return withTreeDay({ ...family, plannedDay: day }, shownDay(day, today, carryOver));
}

function addToParent(task: Task, subtask: Task): Task {
  if (task.id === subtask.parentId) return reopenOne({ ...task, subtasks: [...task.subtasks, subtask] });
  if (!containsTask(task, subtask.parentId as string)) return task;
  return reopenOne({ ...task, subtasks: task.subtasks.map((child) => addToParent(child, subtask)) });
}

export function withSubtask(family: Task, subtask: Task, today: string, carryOver = true): Task {
  return placedOnDay(family, addToParent(family, subtask), today, carryOver);
}

function removeFromTree(task: Task, id: string, today: string): Task {
  if (!containsTask(task, id)) return task;
  const subtasks = task.subtasks.filter((subtask) => subtask.id !== id).map((subtask) => removeFromTree(subtask, id, today));
  const next = { ...task, subtasks };
  return allFinished(subtasks) ? finishOne(next, today) : next;
}

export function withoutSubtask(family: Task, id: string, today: string): Task {
  return placedOnDay(family, removeFromTree(family, id, today), today, true);
}

export function buildTask(fields: NewTaskFields & { day: string }, today: string, carryOver = true): Task {
  return {
    id: fields.id,
    parentId: null,
    title: fields.title.trim(),
    status: fields.status,
    highPriority: fields.highPriority,
    finished: false,
    day: shownDay(fields.day, today, carryOver),
    plannedDay: fields.day,
    completedOn: null,
    dueDay: fields.dueDay ?? null,
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
    dueDay: fields.dueDay ?? null,
    createdAt: new Date().toISOString(),
    subtasks: [],
  };
}

export const buildSubtaskTree = (items: NewPastedTask[], parent: Task): Task[] =>
  items.map(({ subtasks, ...fields }) => {
    const node = buildSubtask({ ...fields, status: 'todo', highPriority: false }, parent);
    return { ...node, subtasks: buildSubtaskTree(subtasks, node) };
  });

export function buildCopy(
  family: Task,
  newIds: Record<string, string>,
  sameSpace: boolean,
  today: string,
  carryOver = true,
): Task {
  const createdAt = new Date().toISOString();
  const day = shownDay(family.day, today, carryOver);
  const unfinished = (task: Task, parentId: string | null): Task => ({
    ...task,
    id: newIds[task.id],
    parentId,
    status: task.finished ? 'todo' : task.status,
    finished: false,
    completedOn: null,
    day,
    createdAt,
    subtasks: task.subtasks.map((subtask) => unfinished(subtask, newIds[task.id])),
  });
  return {
    ...unfinished(family, null),
    title: sameSpace ? copyTitle(family.title) : family.title,
    plannedDay: family.day,
  };
}
