'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { type RefObject, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/shared/components/ui/context-menu';
import { ViewOnlyBadgeComponent } from '@/features/spaces';
import { cn } from '@/shared/utils/cn';
import { usePageMutations } from '../hooks/usePageMutations';
import { type NotebookPage, pageSnippet, pageTitle } from './page-types';

type PageRowProps = {
  page: NotebookPage;
  href: string;
  isActive: boolean;
  canReorder: boolean;
  canEdit: boolean;
  dragging: RefObject<boolean>;
};

function PageRow({ page, href, isActive, canReorder, canEdit, dragging }: PageRowProps) {
  const { remove } = usePageMutations();
  const [confirming, setConfirming] = useState(false);
  const sortable = useSortable({ id: page.id, disabled: !canReorder });
  const snippet = pageSnippet(page.content);

  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cn('relative', sortable.isDragging && 'z-20 rounded-lg bg-accent')}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!canEdit}>
          <Link
            href={href}
            draggable={false}
            onClick={(event) => {
              if (dragging.current) event.preventDefault();
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-roledescription={canReorder ? 'sortable page' : undefined}
            aria-describedby={canReorder ? sortable.attributes['aria-describedby'] : undefined}
            {...(canReorder ? sortable.listeners : {})}
            className={cn('block rounded-lg px-2.5 py-2 hover:bg-accent', isActive && 'bg-muted')}
          >
            <span className="block truncate text-sm font-medium">{pageTitle(page)}</span>
            <span className="block truncate text-xs text-muted-foreground">{snippet || 'Empty page'}</span>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setConfirming(true)}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {canEdit && <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{pageTitle(page)}&quot; will move to Trash. You can restore it from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(page.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </li>
  );
}

type PageListProps = {
  title?: string;
  pages: NotebookPage[];
  activeId?: string;
  isPending: boolean;
  hrefOf: (id: string) => string;
  onAddPage: () => void;
  canEdit?: boolean;
};

export function PageListComponent({ title, pages, activeId, isPending, hrefOf, onAddPage, canEdit = true }: PageListProps) {
  const { reorder } = usePageMutations();
  // The whole row drags: a click still opens the page, Enter still follows the link and Space picks it up.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );
  const ids = pages.map(({ id }) => id);
  const canReorder = canEdit && !isPending && pages.length > 1;
  // Letting go of a dragged row also clicks its link; this swallows that click so the page doesn't open.
  const dragging = useRef(false);
  const endDrag = () => setTimeout(() => (dragging.current = false));

  function handleDragEnd({ active, over }: DragEndEvent) {
    endDrag();
    if (!over || active.id === over.id) return;
    reorder.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <section aria-label="Pages" className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        <ViewOnlyBadgeComponent />
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>
      </div>
      {canEdit && (
        <Button variant="outline" size="sm" onClick={onAddPage}>
          <Plus aria-hidden />
          Add page
        </Button>
      )}
      <DndContext
        id="notebook-pages"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => (dragging.current = true)}
        onDragEnd={handleDragEnd}
        onDragCancel={endDrag}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-0.5">
            {pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                href={hrefOf(page.id)}
                isActive={page.id === activeId}
                canReorder={canReorder}
                canEdit={canEdit}
                dragging={dragging}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}
