'use client';

import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { SIDEBAR_WIDTH, useSidebarWidth } from '../hooks/useSidebarWidth';

const KEYBOARD_STEP = 10;

export function ResizableSidebarComponent({ children }: { children: ReactNode }) {
  const [width, setWidth] = useSidebarWidth();
  const drag = useRef<{ startX: number; startWidth: number }>(undefined);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setWidth(width + (event.key === 'ArrowLeft' ? -KEYBOARD_STEP : KEYBOARD_STEP));
  }

  return (
    <div className="relative hidden shrink-0 md:block" style={{ width }}>
      <aside className="flex h-full overflow-y-auto p-3">{children}</aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_WIDTH.min}
        aria-valuemax={SIDEBAR_WIDTH.max}
        aria-valuenow={width}
        tabIndex={0}
        className="group/resizer absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none outline-none"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { startX: event.clientX, startWidth: width };
        }}
        onPointerMove={(event) => {
          if (drag.current) setWidth(drag.current.startWidth + event.clientX - drag.current.startX);
        }}
        onPointerUp={() => (drag.current = undefined)}
        onPointerCancel={() => (drag.current = undefined)}
        onKeyDown={handleKeyDown}
      >
        <span className="absolute inset-y-6 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-transparent transition-colors group-hover/resizer:bg-muted-foreground group-focus-visible/resizer:bg-foreground" />
      </div>
    </div>
  );
}
