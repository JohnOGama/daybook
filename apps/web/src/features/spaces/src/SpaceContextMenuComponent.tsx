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
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { useDeleteSpace } from '../hooks/useDeleteSpace';
import { useDuplicateSpace } from '../hooks/useDuplicateSpace';
import { useMoveSpace } from '../hooks/useMoveSpace';
import { useLeaveShare } from '../hooks/useShares';
import { useSpaces } from '../hooks/useSpaces';
import { ShareDialogComponent } from './ShareDialogComponent';
import { isOwn } from './space-tree';
import type { Space, SpaceTool } from './space-types';

const CONTENT_NAMES: Record<SpaceTool, string> = {
  list: 'tasks',
  notebook: 'pages',
  book: 'chapters',
  vault: 'items',
  budget: 'accounts and entries',
  fitness: 'logs, plans and templates',
  jobs: 'jobs and your CV',
  diagram: 'its diagram',
  pipelines: 'its runs and its Jenkins key',
};

type SpaceContextMenuProps = {
  space: Space;
  onEdit: () => void;
  children: ReactNode;
};

function LeaveMenu({ space, children }: { space: Space; children: ReactNode }) {
  const leave = useLeaveShare();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setConfirming(true)}>Leave</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave &quot;{space.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              It will disappear from Shared with me. {space.ownerName ?? 'The owner'} can share it with you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => leave.mutate(space.id)}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SpaceContextMenuComponent({ space, onEdit, children }: SpaceContextMenuProps) {
  if (isOwn(space)) return <OwnerMenu space={space} onEdit={onEdit}>{children}</OwnerMenu>;
  if (space.parentId === null) return <LeaveMenu space={space}>{children}</LeaveMenu>;
  return children;
}

function OwnerMenu({ space, onEdit, children }: SpaceContextMenuProps) {
  const deleteSpace = useDeleteSpace();
  const duplicateSpace = useDuplicateSpace();
  const moveSpace = useMoveSpace();
  const { data: spaces = [] } = useSpaces();
  const [confirming, setConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const editChosen = useRef(false);
  const isFolder = space.kind === 'folder';
  const otherFolders = isFolder
    ? []
    : spaces.filter((folder) => folder.kind === 'folder' && isOwn(folder) && folder.id !== space.parentId);
  const canMove = otherFolders.length > 0 || (!isFolder && space.parentId !== null);

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
          {!isFolder && space.tool !== 'vault' && space.tool !== 'budget' && space.tool !== 'fitness' && space.tool !== 'jobs' && space.tool !== 'pipelines' && (
            <ContextMenuItem onSelect={() => duplicateSpace.mutate(space)}>Duplicate</ContextMenuItem>
          )}
          {canMove && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {space.parentId !== null && (
                  <ContextMenuItem onSelect={() => moveSpace.mutate({ id: space.id, parentId: null })}>No folder</ContextMenuItem>
                )}
                {otherFolders.map((folder) => (
                  <ContextMenuItem key={folder.id} onSelect={() => moveSpace.mutate({ id: space.id, parentId: folder.id })}>
                    {folder.title}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          {space.tool !== 'vault' && <ContextMenuItem onSelect={() => setSharing(true)}>Share…</ContextMenuItem>}
          <ContextMenuItem onSelect={() => setConfirming(true)}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ShareDialogComponent space={space} open={sharing} onOpenChange={setSharing} />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {isFolder ? 'folder' : 'space'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isFolder
                ? `"${space.title}", the spaces inside it, and all their tasks will move to Trash. You can restore them from there.`
                : `"${space.title}" and all its ${CONTENT_NAMES[space.tool ?? 'list']} will move to Trash. You can restore them from there.`}
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
