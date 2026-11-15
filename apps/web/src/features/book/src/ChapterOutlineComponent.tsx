'use client';

import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BookOpenText, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { type NotebookPage, usePageMutations } from '@/features/notebook';
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
import { ReorderHandleComponent } from '@/shared/components/ReorderHandleComponent';
import { Button } from '@/shared/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/shared/components/ui/context-menu';
import { ViewOnlyBadgeComponent } from '@/features/spaces';
import { cn } from '@/shared/utils/cn';
import { chapterTitle, formatWords, readingTime, wordCount } from './book-stats';

type ChapterRowProps = { chapter: NotebookPage; number: number; href: string; isActive: boolean; canReorder: boolean; canEdit: boolean };

function ChapterRow({ chapter, number, href, isActive, canReorder, canEdit }: ChapterRowProps) {
  const { remove } = usePageMutations();
  const [confirming, setConfirming] = useState(false);
  const sortable = useSortable({ id: chapter.id, disabled: !canReorder });
  const title = chapterTitle(chapter);

  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cn('group/row relative', sortable.isDragging && 'z-20 rounded-lg bg-accent')}
    >
      {canReorder && <ReorderHandleComponent title={title} sortable={sortable} className="top-2 left-1.5" />}
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!canEdit}>
          <Link
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn('flex gap-2.5 rounded-lg px-2.5 py-2 hover:bg-accent', isActive && 'bg-muted')}
          >
            <span aria-hidden className="w-4 shrink-0 pt-px text-right text-sm text-muted-foreground tabular-nums">
              {number}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{formatWords(wordCount(chapter.content))}</span>
            </span>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setConfirming(true)}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {canEdit && <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{title}&quot; will move to Trash. You can restore it from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(chapter.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </li>
  );
}

type ChapterOutlineProps = {
  title?: string;
  chapters: NotebookPage[];
  activeId?: string;
  isPending: boolean;
  chapterHref: (id: string) => string;
  readHref: string;
  onAddChapter: () => void;
  canEdit?: boolean;
};

export function ChapterOutlineComponent({
  title,
  chapters,
  activeId,
  isPending,
  chapterHref,
  readHref,
  onAddChapter,
  canEdit = true,
}: ChapterOutlineProps) {
  const { reorder } = usePageMutations();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const words = chapters.reduce((total, chapter) => total + wordCount(chapter.content), 0);
  const ids = chapters.map(({ id }) => id);
  const canReorder = canEdit && !isPending && chapters.length > 1;

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    reorder.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  return (
    <section aria-label="Chapters" className="flex flex-col gap-2 p-3">
      <div className="px-2.5 pt-2">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        <ViewOnlyBadgeComponent />
        <p className="text-[13px] text-muted-foreground">
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · {formatWords(words)}
          {words > 0 && ` · ${readingTime(words)}`}
        </p>
      </div>
      <div className="flex gap-2">
        {canEdit && (
          <Button variant="outline" size="sm" className="flex-1" onClick={onAddChapter}>
            <Plus aria-hidden />
            Add chapter
          </Button>
        )}
        {chapters.length > 0 && (
          <Button asChild variant="outline" size="sm">
            <Link href={readHref}>
              <BookOpenText aria-hidden />
              Read
            </Link>
          </Button>
        )}
      </div>
      <DndContext id="book-chapters" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-0.5">
            {chapters.map((chapter, index) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                number={index + 1}
                href={chapterHref(chapter.id)}
                isActive={chapter.id === activeId}
                canReorder={canReorder}
                canEdit={canEdit}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </section>
  );
}
