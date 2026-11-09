import { STATUS_LABELS, STATUSES, type Task, type TaskStatus } from './task-types';

export type KanbanColumnId = TaskStatus | 'completed';

export const KANBAN_COLUMNS: { id: KanbanColumnId; label: string }[] = [
  ...STATUSES.map((id) => ({ id, label: STATUS_LABELS[id] })),
  { id: 'completed', label: 'Completed' },
];

export const columnOf = (task: Task): KanbanColumnId => (task.finished ? 'completed' : task.status);

export const hasKanban = (space: { tool: string | null } | undefined) => space?.tool === 'list';
