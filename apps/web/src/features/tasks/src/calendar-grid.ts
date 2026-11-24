import { addDays, localDay } from '@/shared/utils/date-formatter';

export { formatMonthHeading, monthGrid, shiftMonth } from '@/shared/utils/month-grid';
import { allInTree } from './task-cache';
import type { Task } from './task-types';

const VISIBLE_ENTRIES = 3;

const daysBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

export function taskSpan(task: Task): { start: string; end: string } {
  const end = task.completedOn ?? task.day;
  const created = localDay(new Date(task.createdAt));
  const planned = task.plannedDay ?? end;
  const start = created > planned ? created : planned;
  return { start: start > end ? end : start, end };
}

export type WeekEntry = {
  task: Task;
  line: number;
  column: number;
  span: number;
  days: number;
  openStart: boolean;
  openEnd: boolean;
};

type Unplaced = Omit<WeekEntry, 'line'> & { parent?: Task };

function weekEntriesOf(task: Task, week: string[]): Unplaced[] {
  const { start, end } = taskSpan(task);
  const first = week[0];
  const last = week[week.length - 1];
  if (end < first || start > last) return [];
  const column = start < first ? 0 : daysBetween(first, start);
  const lastColumn = end > last ? week.length - 1 : daysBetween(first, end);
  const subtaskColumn = week.indexOf(task.day);
  const subtasks = subtaskColumn === -1 ? [] : allInTree(task).slice(1);
  return [
    {
      task,
      column,
      span: lastColumn - column + 1,
      days: daysBetween(start, end) + 1,
      openStart: start < first,
      openEnd: end > last,
    },
    ...subtasks.map((subtask) => ({
      task: subtask,
      parent: task,
      column: subtaskColumn,
      span: 1,
      days: 1,
      openStart: false,
      openEnd: false,
    })),
  ];
}

// Packs a week's entries into lines so none overlap; entries past the visible lines count towards each day's "+N more".
export function weekLayout(week: string[], tasks: Task[]): { entries: WeekEntry[]; more: number[] } {
  const unplaced = tasks
    .flatMap((task) => weekEntriesOf(task, week))
    .sort((a, b) => a.column - b.column || b.span - a.span);
  const taken: boolean[][] = [];
  const entries: WeekEntry[] = [];
  const more = week.map(() => 0);
  const hidden = new Set<Task>();
  // A parent always sorts before its subtasks: they sit on its last visible day.
  for (const { parent, ...entry } of unplaced) {
    const columns = Array.from({ length: entry.span }, (_, index) => entry.column + index);
    if (parent && hidden.has(parent)) {
      for (const column of columns) more[column]++;
      continue;
    }
    let line = 0;
    while (columns.some((column) => taken[line]?.[column])) line++;
    taken[line] ??= [];
    for (const column of columns) taken[line][column] = true;
    if (line < VISIBLE_ENTRIES) entries.push({ ...entry, line });
    else {
      hidden.add(entry.task);
      for (const column of columns) more[column]++;
    }
  }
  return { entries, more };
}

export function dayListHref(day: string, today: string, filters: URLSearchParams): string {
  const query = new URLSearchParams(filters);
  if (day !== today) query.set('day', day);
  return query.size > 0 ? `/list?${query}` : '/list';
}
