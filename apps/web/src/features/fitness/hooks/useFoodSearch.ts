'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fetchRecentFoods, searchFoods } from '../src/fitness-api';
import { useFitnessSpaceId } from './useFitness';

const SEARCH_AFTER_MS = 250;

// Foods matching what was typed, or the most recently logged foods while the box is empty.
export function useFoodSearch(text: string) {
  const spaceId = useFitnessSpaceId();
  const [q, setQ] = useState(text.trim());

  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), SEARCH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return useQuery({
    queryKey: ['fitness-foods', spaceId, q],
    queryFn: () => (q ? searchFoods(spaceId as string, q) : fetchRecentFoods(spaceId as string)),
    enabled: Boolean(spaceId),
    placeholderData: (previous) => previous,
  });
}
