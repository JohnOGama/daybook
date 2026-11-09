import { parseListLines } from '@/shared/utils/parse-list-lines';

export type PastedTask = { title: string; subtasks: string[] };

const MAX_TITLE_LENGTH = 200;

export function parseTaskList(text: string): PastedTask[] {
  const list: PastedTask[] = [];
  let parentIndent = 0;
  for (const line of parseListLines(text)) {
    const { indent } = line;
    const title = line.text.slice(0, MAX_TITLE_LENGTH);
    const parent = list.at(-1);
    if (parent && indent > parentIndent) {
      parent.subtasks.push(title);
    } else {
      list.push({ title, subtasks: [] });
      parentIndent = indent;
    }
  }
  return list;
}

export function isTaskList(text: string): boolean {
  const list = parseTaskList(text);
  return list.length > 1 || (list[0]?.subtasks.length ?? 0) > 0;
}

const counted = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function describeTaskList(list: { subtasks: unknown[] }[]): string {
  const subtasks = list.reduce((total, task) => total + task.subtasks.length, 0);
  const tasks = counted(list.length, 'task');
  return subtasks > 0 ? `${tasks} and ${counted(subtasks, 'subtask')}` : tasks;
}
