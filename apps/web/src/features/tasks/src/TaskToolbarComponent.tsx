'use client';

import { CheckCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { addDays } from '@/shared/utils/date-formatter';
import { FiltersMenuComponent } from './FiltersMenuComponent';

type TaskToolbarProps = {
  day: string;
  today: string;
  onNewTask: () => void;
};

export function TaskToolbarComponent({ day, today, onNewTask }: TaskToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const showClosed = params.get('closed') !== '0';

  function update(change: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params);
    change(next);
    router.replace(`${pathname}?${next}`);
  }

  const goTo = (target: string) =>
    update((next) => {
      if (target === today) next.delete('day');
      else next.set('day', target);
    });

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
      <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => goTo(addDays(day, -1))}>
        <ChevronLeft aria-hidden />
      </Button>
      <Button variant="outline" size="icon" aria-label="Next day" onClick={() => goTo(addDays(day, 1))}>
        <ChevronRight aria-hidden />
      </Button>
      <Button size="sm" onClick={() => goTo(today)}>
        Today
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-pressed={showClosed}
          onClick={() =>
            update((next) => {
              if (showClosed) next.set('closed', '0');
              else next.delete('closed');
            })
          }
        >
          <CheckCheck aria-hidden />
          Show closed
        </Button>
        <FiltersMenuComponent />
        <Button variant="outline" size="sm" onClick={onNewTask}>
          <Plus aria-hidden />
          New task
        </Button>
      </div>
    </div>
  );
}
