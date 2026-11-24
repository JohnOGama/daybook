'use client';

import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Skeleton } from 'skullet/react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { ReorderHandleComponent } from '@/shared/components/ReorderHandleComponent';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useCreateSpaceGroup, useDeleteSpaceGroup, useRenameSpaceGroup, useReorderSpaceGroups, useSpaceGroups } from '../hooks/useSpaceGroups';
import { useSpaces } from '../hooks/useSpaces';
import { groupOf } from './space-cache';
import { isOwn } from './space-tree';
import type { SpaceGroup } from './space-types';
import { cn } from '@/shared/utils/cn';
import { keepRowInTable } from '@/shared/utils/keep-row-in-table';

const SAMPLE_GROUPS: SpaceGroup[] = [
  { id: 'sample-1', title: 'Spaces' },
  { id: 'sample-2', title: 'Work' },
];

type TitleDialogProps = { heading: string; initial: string; action: string; onSave(title: string): void; onClose(): void };

function TitleDialog({ heading, initial, action, onSave, onClose }: TitleDialogProps) {
  const [title, setTitle] = useState(initial);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (next && next !== initial) onSave(next);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input aria-label="Group name" autoFocus maxLength={200} placeholder="e.g. Work" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={title.trim().length === 0}>
              {action}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupRow({ group, count, isOnly, canReorder }: { group: SpaceGroup; count: number; isOnly: boolean; canReorder: boolean }) {
  const sortable = useSortable({ id: group.id, disabled: !canReorder });
  const rename = useRenameSpaceGroup();
  const remove = useDeleteSpaceGroup();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <TableRow
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      className={cn('group/row relative bg-card hover:bg-transparent', sortable.isDragging && 'z-10 shadow-sm')}
    >
      <TableCell className="py-3 pl-4 font-medium">
        <div className="flex items-center gap-2">
          {canReorder && <ReorderHandleComponent title={group.title} sortable={sortable} className="relative shrink-0 bg-transparent opacity-100" />}
          {group.title}
        </div>
      </TableCell>
      <TableCell className="text-[13px] text-muted-foreground">
        {count} {count === 1 ? 'item' : 'items'}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Rename ${group.title}`} onClick={() => setRenaming(true)}>
            Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${group.title}`}
            title={isOnly ? "You can't delete your only group" : undefined}
            disabled={isOnly}
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        </div>
        {renaming && (
          <TitleDialog heading="Rename group" initial={group.title} action="Save" onSave={(title) => rename.mutate({ id: group.id, title })} onClose={() => setRenaming(false)} />
        )}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &quot;{group.title}&quot;?</AlertDialogTitle>
              <AlertDialogDescription>
                {count === 0
                  ? 'The group is empty, so nothing else goes with it.'
                  : `Its ${count} ${count === 1 ? 'folder or space' : 'folders and spaces'}, and everything in them, will move to Trash. Restoring any of them brings the group back.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => remove.mutate(group.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

// Settings > Spaces: the sidebar's groups ("Spaces", "Work"...), with New, Rename, Delete and drag to reorder.
export function SpaceGroupsManagerComponent() {
  const { data: groupData, isPending, isError } = useSpaceGroups();
  const { data: spaces = [] } = useSpaces();
  const createGroup = useCreateSpaceGroup();
  const reorder = useReorderSpaceGroups();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [creating, setCreating] = useState(false);
  const groups = isPending ? SAMPLE_GROUPS : (groupData ?? []);
  const topLevel = spaces.filter((space) => space.parentId === null && isOwn(space));
  const countIn = (id: string) => topLevel.filter((space) => groupOf(space, groups) === id).length;
  const ids = groups.map((group) => group.id);
  const canReorder = !isPending && groups.length > 1;

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    reorder.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your groups. Please try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setCreating(true)} disabled={isPending}>
          <Plus aria-hidden />
          New group
        </Button>
      </div>
      <Skeleton loading={isPending} label="Loading groups">
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Group</TableHead>
                <TableHead>Holds</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <DndContext
              id="space-groups"
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[keepRowInTable]}
              autoScroll={false}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {groups.map((group) => (
                    <GroupRow key={group.id} group={group} count={countIn(group.id)} isOnly={groups.length === 1} canReorder={canReorder} />
                  ))}
                </TableBody>
              </SortableContext>
            </DndContext>
          </Table>
        </div>
      </Skeleton>
      {creating && <TitleDialog heading="New group" initial="" action="Create" onSave={createGroup} onClose={() => setCreating(false)} />}
    </div>
  );
}
