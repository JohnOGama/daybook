'use client';

import { useEffect, useState } from 'react';
import { localDay } from '@/shared/utils/date-formatter';

export function useToday(): string {
  const [today, setToday] = useState(() => localDay());

  useEffect(() => {
    const refresh = () => setToday(localDay());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return today;
}
