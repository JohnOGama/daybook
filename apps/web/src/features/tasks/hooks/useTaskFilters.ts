'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { STATUSES, type TaskFilters, type TaskStatus } from '../src/task-types';

export function useTaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: TaskFilters = {
    statuses: STATUSES.filter((status) => params.get('status')?.split(',').includes(status)),
    high: params.get('high') === '1',
  };

  function apply(next: TaskFilters) {
    const updated = new URLSearchParams(params);
    if (next.statuses.length > 0) updated.set('status', next.statuses.join(','));
    else updated.delete('status');
    if (next.high) updated.set('high', '1');
    else updated.delete('high');
    router.replace(`${pathname}?${updated}`);
  }

  function toggleStatus(status: TaskStatus) {
    apply({
      ...filters,
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((item) => item !== status)
        : [...filters.statuses, status],
    });
  }

  function toggleHigh() {
    apply({ ...filters, high: !filters.high });
  }

  return { filters, toggleStatus, toggleHigh };
}
