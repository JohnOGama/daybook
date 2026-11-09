'use client';

import { type KeyboardEvent, useRef } from 'react';
import { type ColumnBoundary, type ColumnWidths, resizeColumns } from './task-columns';

const KEYBOARD_STEP = 10;

type ColumnResizerProps = {
  boundary: ColumnBoundary;
  label: string;
  widths: ColumnWidths;
  onChange: (widths: ColumnWidths) => void;
};

export function ColumnResizerComponent({ boundary, label, widths, onChange }: ColumnResizerProps) {
  const drag = useRef<{ startX: number; startWidths: ColumnWidths }>(undefined);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onChange(resizeColumns(widths, boundary, event.key === 'ArrowLeft' ? -KEYBOARD_STEP : KEYBOARD_STEP));
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={widths[boundary.right]}
      tabIndex={0}
      className="group/resizer absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none outline-none"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidths: widths };
      }}
      onPointerMove={(event) => {
        if (drag.current) {
          onChange(resizeColumns(drag.current.startWidths, boundary, event.clientX - drag.current.startX));
        }
      }}
      onPointerUp={() => (drag.current = undefined)}
      onPointerCancel={() => (drag.current = undefined)}
      onKeyDown={handleKeyDown}
    >
      <span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover/resizer:bg-muted group-focus-visible/resizer:bg-foreground" />
    </div>
  );
}
