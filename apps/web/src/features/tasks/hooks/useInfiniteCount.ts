'use client';

import { useEffect, useRef, useState } from 'react';

const BATCH_SIZE = 10;
const LOAD_AHEAD = '400px 0px';

export function useInfiniteCount(total: number, paused: boolean) {
  const [count, setCount] = useState(BATCH_SIZE);
  const endRef = useRef<HTMLDivElement>(null);
  const hasMore = count < total;

  // Depends on count so a new observer re-checks the end, which may still be in view after a batch.
  useEffect(() => {
    const end = endRef.current;
    if (!end || !hasMore || paused) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setCount((current) => current + BATCH_SIZE);
      },
      { root: end.closest('main'), rootMargin: LOAD_AHEAD },
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [count, hasMore, paused]);

  return [count, endRef] as const;
}
