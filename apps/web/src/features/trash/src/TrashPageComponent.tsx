'use client';

import { Button } from '@/shared/components/ui/button';
import { CheckSquare, Folder, Hash, ListTree } from 'lucide-react';
import { Skeleton } from 'skullet/react';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { EmptyTrashIcon } from '@/shared/components/EmptyStateIconsComponent';
import { formatShortDate } from '@/shared/utils/date-formatter';
import { useRestoreItem } from '../hooks/useRestoreItem';
import { useTrash } from '../hooks/useTrash';
import type { TrashItem } from './trash-types';

const ICONS: Record<TrashItem['type'], typeof Hash> = {
  task: CheckSquare,
  subtask: ListTree,
  space: Hash,
  folder: Folder,
};

const SAMPLE_ITEMS: TrashItem[] = ['sample-1', 'sample-2', 'sample-3'].map((id) => ({
  id,
  type: 'task',
  title: 'Book the workshop room',
  location: 'My List',
  deletedAt: '2026-01-15T12:00:00.000Z',
}));

export function TrashPageComponent() {
  const { data, isPending, isError } = useTrash();
  const items = isPending ? SAMPLE_ITEMS : (data ?? []);
  const restore = useRestoreItem();

  return (
    <>
      <header className="border-b px-4 pt-5 pb-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Restoring puts an item back where it was.</p>
      </header>

      {isError && (
        <p role="alert" className="px-6 py-8 text-sm text-destructive">
          Could not load the trash. Please try again.
        </p>
      )}
      {!isPending && !isError && items.length === 0 && (
        <EmptyStateComponent
          icon={<EmptyTrashIcon />}
          title="Trash is empty"
          description="Deleted tasks, spaces and folders wait here until you restore them."
        />
      )}

      <Skeleton loading={isPending} label="Loading trash">
        <ul className="mx-4 my-4 overflow-hidden rounded-2xl border bg-card empty:hidden md:mx-6">
          {items.map((item) => {
            const Icon = ICONS[item.type];
            return (
              <li key={`${item.type}-${item.id}`} className="row-enter flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 md:px-6">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {item.location && <p className="truncate text-xs text-muted-foreground">{item.location}</p>}
                </div>
                <span className="shrink-0 text-[13px] text-muted-foreground">{formatShortDate(item.deletedAt)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Restore ${item.title}`}
                  onClick={() => restore.mutate(item)}
                >
                  Restore
                </Button>
              </li>
            );
          })}
        </ul>
      </Skeleton>
    </>
  );
}
