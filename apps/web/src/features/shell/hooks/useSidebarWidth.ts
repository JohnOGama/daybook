'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'daybook.sidebar-width';
export const SIDEBAR_WIDTH = { min: 180, initial: 224, max: 420 };

const clamped = (width: number) => Math.min(Math.max(width, SIDEBAR_WIDTH.min), SIDEBAR_WIDTH.max);

function readStoredWidth() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return stored ? clamped(stored) : SIDEBAR_WIDTH.initial;
  } catch {
    return SIDEBAR_WIDTH.initial;
  }
}

export function useSidebarWidth() {
  const [width, setWidth] = useState(readStoredWidth);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {}
  }, [width]);

  return [width, (next: number) => setWidth(clamped(next))] as const;
}
