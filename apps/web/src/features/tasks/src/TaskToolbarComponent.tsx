'use client';

import { CheckCheck, Plus, Trash2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { FiltersMenuComponent } from './FiltersMenuComponent';

type TaskToolbarProps = { onNewTask: () => void; onClearTable?: () => void; canEdit?: boolean; children?: ReactNode };

export function TaskToolbarComponent({ onNewTask, onClearTable, canEdit = true, children }: TaskToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const showClosed = params.get('closed') !== '0';

  function toggleClosed() {
    const next = new URLSearchParams(params);
    if (showClosed) next.set('closed', '0');
    else next.delete('closed');
    router.replace(`${pathname}?${next}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
      {children}
      <div role="group" aria-label="Task actions" className="ml-auto flex items-center gap-1 rounded-xl border bg-card p-1">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={showClosed}
          className={cn(showClosed && 'bg-accent')}
          onClick={toggleClosed}
        >
          <CheckCheck aria-hidden />
          Show closed
        </Button>
        <FiltersMenuComponent />
        {canEdit && onClearTable && (
          <Button variant="ghost" size="sm" onClick={onClearTable}>
            <Trash2 aria-hidden />
            Clear table
          </Button>
        )}
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={onNewTask}>
            <Plus aria-hidden />
            New task
          </Button>
        )}
      </div>
    </div>
  );
}
