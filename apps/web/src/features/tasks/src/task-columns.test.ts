import { expect, it } from 'vitest';
import { DEFAULT_COLUMN_WIDTHS, parseColumnWidths, resizeColumns } from './task-columns';

const widths = { status: 150, priority: 100, due: 104, created: 100, completed: 120 };

it('moves width between the two columns beside a boundary', () => {
  expect(resizeColumns(widths, { left: 'status', right: 'priority' }, 10)).toEqual({
    status: 160,
    priority: 90,
    due: 104,
    created: 100,
    completed: 120,
  });
});

it('lets the task column absorb a change at its boundary', () => {
  expect(resizeColumns(widths, { right: 'status' }, -20).status).toBe(170);
});

it('stops at the smaller side minimum and keeps the total', () => {
  const next = resizeColumns(widths, { left: 'status', right: 'priority' }, 500);
  expect(next.priority).toBe(72);
  expect(next.status + next.priority).toBe(250);
});

it('falls back to defaults for missing, bad or too-small stored widths', () => {
  expect(parseColumnWidths(null)).toEqual(DEFAULT_COLUMN_WIDTHS);
  expect(parseColumnWidths('not json')).toEqual(DEFAULT_COLUMN_WIDTHS);
  expect(parseColumnWidths('{"status":5,"priority":90,"created":"x"}')).toEqual({
    ...DEFAULT_COLUMN_WIDTHS,
    priority: 90,
  });
});
