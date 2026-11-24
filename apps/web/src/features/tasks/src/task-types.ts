export type TaskStatus = 'todo' | 'in_progress' | 'on_hold';

export type Task = {
  id: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  highPriority: boolean;
  finished: boolean;
  day: string;
  plannedDay: string | null;
  completedOn: string | null;
  // A deadline, separate from the day the task shows on.
  dueDay: string | null;
  createdAt: string;
  subtasks: Task[];
};

export type TaskFilters = {
  statuses: TaskStatus[];
  high: boolean;
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  on_hold: 'On hold',
};

export const STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];

export const STATUS_ACCENTS: Record<TaskStatus | 'completed', string> = {
  todo: 'text-status-todo',
  in_progress: 'text-status-progress',
  on_hold: 'text-status-hold',
  completed: 'text-status-done',
};
