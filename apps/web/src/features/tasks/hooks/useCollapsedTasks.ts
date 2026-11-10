'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'daybook.collapsed-tasks';

function readCollapsed(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

// ponytail: ids of deleted tasks stay stored; trim the list if it ever gets near the storage limit
export function useCollapsedTasks() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
    } catch {}
  }, [collapsed]);

  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  return [collapsed, toggle] as const;
}
