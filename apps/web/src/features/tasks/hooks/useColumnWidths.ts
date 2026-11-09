'use client';

import { useEffect, useState } from 'react';
import { parseColumnWidths } from '../src/task-columns';

const STORAGE_KEY = 'daybook.task-columns';

function readStoredWidths(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useColumnWidths() {
  const [widths, setWidths] = useState(() => parseColumnWidths(readStoredWidths()));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {}
  }, [widths]);

  return [widths, setWidths] as const;
}
