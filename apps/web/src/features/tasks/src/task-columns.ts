export type ColumnId = 'status' | 'priority' | 'due' | 'created' | 'completed';
export type ColumnWidths = Record<ColumnId, number>;
export type ColumnBoundary = { left?: ColumnId; right: ColumnId };

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = { status: 128, priority: 88, due: 104, created: 92, completed: 112 };

const MIN_COLUMN_WIDTHS: ColumnWidths = { status: 112, priority: 72, due: 88, created: 72, completed: 100 };
const FIXED_COLUMNS_WIDTH = 132;
const MIN_TASK_COLUMN_WIDTH = 260;

export function resizeColumns(widths: ColumnWidths, { left, right }: ColumnBoundary, delta: number): ColumnWidths {
  const largest = widths[right] - MIN_COLUMN_WIDTHS[right];
  const smallest = left ? MIN_COLUMN_WIDTHS[left] - widths[left] : -Infinity;
  const applied = Math.min(largest, Math.max(smallest, delta));
  return {
    ...widths,
    [right]: widths[right] - applied,
    ...(left ? { [left]: widths[left] + applied } : {}),
  };
}

export function tableMinWidth(widths: ColumnWidths): number {
  return (
    FIXED_COLUMNS_WIDTH + MIN_TASK_COLUMN_WIDTH + widths.status + widths.priority + widths.due + widths.created + widths.completed
  );
}

export function parseColumnWidths(stored: string | null): ColumnWidths {
  try {
    const parsed = JSON.parse(stored ?? '{}');
    const valid = (id: ColumnId) => Number.isFinite(parsed[id]) && parsed[id] >= MIN_COLUMN_WIDTHS[id];
    return {
      status: valid('status') ? parsed.status : DEFAULT_COLUMN_WIDTHS.status,
      priority: valid('priority') ? parsed.priority : DEFAULT_COLUMN_WIDTHS.priority,
      due: valid('due') ? parsed.due : DEFAULT_COLUMN_WIDTHS.due,
      created: valid('created') ? parsed.created : DEFAULT_COLUMN_WIDTHS.created,
      completed: valid('completed') ? parsed.completed : DEFAULT_COLUMN_WIDTHS.completed,
    };
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}
