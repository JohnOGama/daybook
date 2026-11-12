'use client';

import type { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type ReorderHandleProps = { title: string; sortable: ReturnType<typeof useSortable>; className?: string };

export function ReorderHandleComponent({ title, sortable, className }: ReorderHandleProps) {
  return (
    <button
      ref={sortable.setActivatorNodeRef}
      type="button"
      aria-label={`Reorder ${title}`}
      {...sortable.attributes}
      {...sortable.listeners}
      className={cn(
        'absolute z-10 grid size-6 cursor-grab touch-none place-items-center rounded-md bg-accent text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing',
        className,
      )}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}
