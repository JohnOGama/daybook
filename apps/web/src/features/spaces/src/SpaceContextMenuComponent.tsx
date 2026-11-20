'use client';

import { MoreHorizontal } from 'lucide-react';
import { type ComponentProps, type ComponentType, type ReactNode, useRef, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useDeleteSpace } from '../hooks/useDeleteSpace';
import { useDuplicateSpace } from '../hooks/useDuplicateSpace';
import { useMoveSpace } from '../hooks/useMoveSpace';
import { useMoveToGroup, useSpaceGroups } from '../hooks/useSpaceGroups';
import { useLeaveShare } from '../hooks/useShares';
import { useSpaces } from '../hooks/useSpaces';
import { ShareDialogComponent } from './ShareDialogComponent';
import { groupOf } from './space-cache';
import { isOwn } from './space-tree';
import { cn } from '@/shared/utils/cn';
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
  skills: 'skills',
  uptime: 'its sites and their history',
};

type SpaceContextMenuProps = {
  space: Space;
  onEdit: () => void;
  // While the row's label is being edited, the ⋯ button stays away.
  editing?: boolean;
  // Where the ⋯ button sits in the row (it needs a `group/row` ancestor to show on hover).
  moreClassName?: string;
  children: ReactNode;
};

// The same items fill the right-click menu and the ⋯ menu, so the two can't drift apart.
type Parts = {
  Item: ComponentType<{ onSelect?: (event: Event) => void; children: ReactNode }>;
  Sub: ComponentType<{ children: ReactNode }>;
  SubTrigger: ComponentType<{ children: ReactNode }>;
  SubContent: ComponentType<{ children: ReactNode }>;
};
const CONTEXT: Parts = { Item: ContextMenuItem, Sub: ContextMenuSub, SubTrigger: ContextMenuSubTrigger, SubContent: ContextMenuSubContent };
const DROPDOWN: Parts = { Item: DropdownMenuItem, Sub: DropdownMenuSub, SubTrigger: DropdownMenuSubTrigger, SubContent: DropdownMenuSubContent };

type MenusProps = {
  label: string;
  items: (parts: Parts) => ReactNode;
  onCloseAutoFocus?: ComponentProps<typeof ContextMenuContent>['onCloseAutoFocus'];
  showMore: boolean;
  moreClassName?: string;
  children: ReactNode;
};

// Right-click on the row, or the ⋯ button that shows while the row is hovered (always on touch screens).
function Menus({ label, items, onCloseAutoFocus, showMore, moreClassName, children }: MenusProps) {
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={onCloseAutoFocus}>{items(CONTEXT)}</ContextMenuContent>
      </ContextMenu>
      {showMore && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`More for ${label}`}
              className={cn(
                'absolute top-1.5 right-1.5 z-10 grid size-6 place-items-center rounded-md bg-accent text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100',
                moreClassName,
              )}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" onCloseAutoFocus={onCloseAutoFocus}>
            {items(DROPDOWN)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

function LeaveMenu({ space, editing, moreClassName, children }: Omit<SpaceContextMenuProps, 'onEdit'>) {
  const leave = useLeaveShare();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Menus label={space.title} showMore={!editing} moreClassName={moreClassName} items={({ Item }) => <Item onSelect={() => setConfirming(true)}>Leave</Item>}>
        {children}
      </Menus>

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

export function SpaceContextMenuComponent({ space, onEdit, editing, moreClassName, children }: SpaceContextMenuProps) {
  if (isOwn(space)) return <OwnerMenu space={space} onEdit={onEdit} editing={editing} moreClassName={moreClassName}>{children}</OwnerMenu>;
  if (space.parentId === null) return <LeaveMenu space={space} editing={editing} moreClassName={moreClassName}>{children}</LeaveMenu>;
  return children;
}

function OwnerMenu({ space, onEdit, editing, moreClassName, children }: SpaceContextMenuProps) {
  const deleteSpace = useDeleteSpace();
  const duplicateSpace = useDuplicateSpace();
  const moveSpace = useMoveSpace();
  const moveToGroup = useMoveToGroup();
  const { data: spaces = [] } = useSpaces();
  const { data: groups = [] } = useSpaceGroups();
  const [confirming, setConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const editChosen = useRef(false);
  const isFolder = space.kind === 'folder';
  const otherFolders = isFolder
    ? []
    : spaces.filter((folder) => folder.kind === 'folder' && isOwn(folder) && folder.id !== space.parentId);
  // A top-level item can go to any other group; a space in a folder can go to any group (it leaves the folder).
  const current = space.parentId === null ? groupOf(space, groups) : undefined;
  const targetGroups = groups.length > 1 || space.parentId !== null ? groups.filter((group) => group.id !== current) : [];
  const canMove = otherFolders.length > 0 || targetGroups.length > 0 || (!isFolder && space.parentId !== null);
  const canDuplicate = !isFolder && !['vault', 'budget', 'fitness', 'jobs', 'pipelines', 'uptime'].includes(space.tool ?? '');

  const items = ({ Item, Sub, SubTrigger, SubContent }: Parts) => (
    <>
      <Item onSelect={() => (editChosen.current = true)}>Edit</Item>
      {canDuplicate && <Item onSelect={() => duplicateSpace.mutate(space)}>Duplicate</Item>}
      {canMove && (
        <Sub>
          <SubTrigger>Move to</SubTrigger>
          <SubContent>
            {space.parentId !== null && <Item onSelect={() => moveSpace.mutate({ id: space.id, parentId: null })}>No folder</Item>}
            {otherFolders.map((folder) => (
              <Item key={folder.id} onSelect={() => moveSpace.mutate({ id: space.id, parentId: folder.id })}>
                {folder.title}
              </Item>
            ))}
            {targetGroups.map((group) => (
              <Item key={group.id} onSelect={() => moveToGroup.mutate({ id: space.id, groupId: group.id })}>
                {group.title} (group)
              </Item>
            ))}
          </SubContent>
        </Sub>
      )}
      {space.tool !== 'vault' && <Item onSelect={() => setSharing(true)}>Share…</Item>}
      <Item onSelect={() => setConfirming(true)}>Delete</Item>
    </>
  );

  return (
    <>
      <Menus
        label={space.title}
        items={items}
        showMore={!editing}
        moreClassName={moreClassName}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (editChosen.current) onEdit();
          editChosen.current = false;
        }}
      >
        {children}
      </Menus>

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
