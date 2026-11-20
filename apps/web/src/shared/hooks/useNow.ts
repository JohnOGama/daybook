'use client';

import { useEffect, useState } from 'react';

// The current time, ticking every second, so running timers and "4s ago" move on their own.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
