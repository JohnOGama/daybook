import { parseListLines } from '@/shared/utils/parse-list-lines';

export type PastedTask = { title: string; subtasks: PastedTask[] };

const MAX_TITLE_LENGTH = 200;

export function parseTaskList(text: string): PastedTask[] {
  const roots: PastedTask[] = [];
  const open: { indent: number; task: PastedTask }[] = [];
  for (const line of parseListLines(text)) {
    while ((open.at(-1)?.indent ?? -1) >= line.indent) open.pop();
    const task: PastedTask = { title: line.text.slice(0, MAX_TITLE_LENGTH), subtasks: [] };
    (open.at(-1)?.task.subtasks ?? roots).push(task);
    open.push({ indent: line.indent, task });
  }
  return roots;
}

export function isTaskList(text: string): boolean {
  const list = parseTaskList(text);
  return list.length > 1 || (list[0]?.subtasks.length ?? 0) > 0;
}

export const countOf = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

type Nested = { subtasks: Nested[] };

export const totalInList = (list: Nested[]): number =>
  list.reduce((total, item) => total + 1 + totalInList(item.subtasks), 0);

export function describeTaskList(list: Nested[]): string {
  const subtasks = totalInList(list) - list.length;
  const tasks = countOf(list.length, 'task');
  return subtasks > 0 ? `${tasks} and ${countOf(subtasks, 'subtask')}` : tasks;
}
