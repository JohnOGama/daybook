export type TaskStatus = 'todo' | 'in_progress' | 'on_hold';

export type Task = {
  id: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  highPriority: boolean;
  finished: boolean;
  day: string;
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
