import type { Modifier } from '@dnd-kit/core';

// A dragged table row moves only up and down, and never past the first or last row, so it can't push its scroll container.
export const keepRowInTable: Modifier = ({ transform, draggingNodeRect: row, containerNodeRect: rows }) => ({
  ...transform,
  x: 0,
  y: row && rows ? Math.min(Math.max(transform.y, rows.top - row.top), rows.bottom - row.bottom) : transform.y,
});
