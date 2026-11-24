import type { Task } from './task-types';

function sampleTask(id: string, title: string, fields: Partial<Task> = {}): Task {
  return {
    id,
    parentId: null,
    title,
    status: 'todo',
    highPriority: false,
    finished: false,
    day: '',
    plannedDay: null,
    completedOn: null,
    dueDay: null,
    createdAt: '2026-01-15T12:00:00.000Z',
    subtasks: [],
    ...fields,
  };
}

export const SAMPLE_TASKS: Task[] = [
  sampleTask('sample-1', 'Review the plan for this week', { highPriority: true }),
  sampleTask('sample-2', 'Reply to open messages', { status: 'in_progress' }),
  sampleTask('sample-3', 'Book the workshop room', { status: 'on_hold' }),
  sampleTask('sample-4', 'Tidy up the notes from Monday'),
];

export function sampleMonthTasks(days: string[]): Task[] {
  return days
    .filter((_, index) => index % 3 === 0)
    .map((day, index) => ({ ...SAMPLE_TASKS[index % SAMPLE_TASKS.length], id: `sample-${day}`, day }));
}
