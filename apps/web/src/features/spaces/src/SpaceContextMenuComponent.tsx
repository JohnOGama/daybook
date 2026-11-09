'use client';

import { type ReactNode, useRef, useState } from 'react';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { useDeleteSpace } from '../hooks/useDeleteSpace';
import { useDuplicateSpace } from '../hooks/useDuplicateSpace';
import type { Space } from './space-types';

type SpaceContextMenuProps = {
  space: Space;
  onEdit: () => void;
  children: ReactNode;
};

export function SpaceContextMenuComponent({ space, onEdit, children }: SpaceContextMenuProps) {
  const deleteSpace = useDeleteSpace();
  const duplicateSpace = useDuplicateSpace();
  const [confirming, setConfirming] = useState(false);
  const editChosen = useRef(false);
  const isFolder = space.kind === 'folder';

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (editChosen.current) onEdit();
            editChosen.current = false;
          }}
        >
          <ContextMenuItem onSelect={() => (editChosen.current = true)}>Edit</ContextMenuItem>
          {!isFolder && <ContextMenuItem onSelect={() => duplicateSpace.mutate(space)}>Duplicate</ContextMenuItem>}
          <ContextMenuItem onSelect={() => setConfirming(true)}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {isFolder ? 'folder' : 'space'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isFolder
                ? `"${space.title}", the spaces inside it, and all their tasks will move to Trash. You can restore them from there.`
                : `"${space.title}" and all its tasks will move to Trash. You can restore them from there.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteSpace.mutate(space.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
