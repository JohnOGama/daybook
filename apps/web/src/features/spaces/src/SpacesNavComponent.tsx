'use client';

import {
  type Active,
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  type Modifier,
  type Over,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Activity, BookMarked, BriefcaseBusiness, Dumbbell, GripVertical, Network, Plus, ScrollText, Users, Workflow } from 'lucide-react';
import Link from 'next/link';
import { type PointerEventHandler, type ReactNode, useState } from 'react';
import { Skeleton } from 'skullet/react';
import {
  BudgetIcon,
  FolderIcon,
  FolderOpenIcon,
  type IconComponent,
  NotebookIcon,
  SpaceIcon,
  VaultIcon,
} from '@/shared/components/BrandIconsComponent';
import { InlineTitleInputComponent } from '@/shared/components/InlineTitleInputComponent';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { useActiveSpace } from '../hooks/useActiveSpace';
import { useMoveSpace } from '../hooks/useMoveSpace';
import { useRenameSpace } from '../hooks/useRenameSpace';
import { useReorderSpaces } from '../hooks/useReorderSpaces';
import { useMoveToGroup, useSpaceGroups } from '../hooks/useSpaceGroups';
import { useSpaces } from '../hooks/useSpaces';
import { CreateSpaceFormComponent } from './CreateSpaceFormComponent';
import { PipelineDotComponent } from './PipelineDotComponent';
import { UptimeDotComponent } from './UptimeDotComponent';
import { SpaceContextMenuComponent } from './SpaceContextMenuComponent';
import { groupOf } from './space-cache';
import { type DropAction, dropAction, type DropSide, GROUP_LIST } from './sidebar-drop';
import { buildOwnTree, buildSharedTree, isOwn, type SpaceNode, spaceHref } from './space-tree';
import type { Space, SpaceGroup, SpaceTool } from './space-types';

type CreatingState = { kind: Space['kind']; parentFolder?: Space; groupId?: string };

const SAMPLE_GROUPS: SpaceGroup[] = [{ id: 'sample-group', title: 'Spaces' }];

// A space goes into a folder when the pointer is over the middle of that folder's header. Otherwise any row can land
// on group rows and headings, and a space also on the spaces inside your other folders. Shared rows are never targets.
const sidebarCollision: CollisionDetection = (args) => {
  const dragged = args.active.data.current;
  const list = String(dragged?.sortable?.containerId ?? '');
  if (dragged?.kind === 'space') {
    const intoFolder = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => container.data.current?.folderId && container.data.current.folderId !== list),
    });
    if (intoFolder.length) return intoFolder;
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(({ data: { current: target } }) => {
      if (target?.folderId) return false;
      if (target?.groupId) return true;
      return String(target?.sortable?.containerId ?? '').startsWith(GROUP_LIST) || (dragged?.kind === 'space' && target?.inOwnFolder);
    }),
  });
};

const dropSide = ({ id, data: { current } }: Active | Over): DropSide => ({
  id: String(id),
  list: current?.sortable?.containerId === undefined ? undefined : String(current.sortable.containerId),
  groupId: current?.groupId,
  folderId: current?.folderId,
  items: current?.sortable?.items.map(String),
});

// A group's heading: its name, and the + (shown on hover) that offers a new space or folder in it. Rows can be dropped on it.
function GroupHeading({ group, isTarget, onAdd }: { group: SpaceGroup; isTarget: boolean; onAdd: (kind: Space['kind']) => void }) {
  const { setNodeRef } = useDroppable({ id: `group-drop:${group.id}`, data: { groupId: group.id } });
  return (
    <div
      ref={setNodeRef}
      className={cn('group/heading mx-2 mt-5 mb-1.5 flex items-center justify-between rounded-md text-[13px] font-medium text-muted-foreground transition-colors', isTarget && 'text-foreground')}
    >
      <span className="truncate">{group.title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Add to ${group.title}`}
          className="grid size-6 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground hover:bg-accent opacity-0 group-hover/heading:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Plus className="size-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => onAdd('space')}>
            <SpaceIcon aria-hidden />
            Space
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAdd('folder')}>
            <FolderIcon aria-hidden />
            Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
type RenderSpaceSummary = (space: Space) => ReactNode;
type Sortable = ReturnType<typeof useSortable>;

const keepRowVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const dragStyle = ({ transform, transition }: Sortable) => ({ transform: CSS.Translate.toString(transform), transition });
// The row stays where it was, faded, while DragPreview follows the pointer.
const draggingClass = ({ isDragging }: Sortable) => isDragging && 'opacity-40';
// The whole row starts a drag (after 4 px, so clicks and double-clicks still work); the keyboard uses the handle.
const dragFromRow = (sortable: Sortable, enabled: boolean) =>
  enabled ? { onPointerDown: sortable.listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined } : {};

// Where a dragged row will land in a group: a line between rows that takes no space, so nothing shifts under the pointer.
const DROP_LINE = (
  <div key="drop-line" aria-hidden className="relative h-0">
    <div className="absolute inset-x-1 -top-px h-0.5 rounded-full bg-foreground" />
  </div>
);

const SAMPLE_SPACES: Space[] = ['My first list', 'Weekly plans', 'Side project'].map((title, index) => ({
  id: `sample-${index}`,
  parentId: null,
  kind: 'space',
  title,
  tool: 'list',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'sample',
  ownerName: null,
}));

function OwnerName({ space }: { space: Space }) {
  if (isOwn(space) || !space.ownerName) return null;
  return <span className="shrink-0 truncate text-xs font-normal text-muted-foreground">{space.ownerName}</span>;
}

function LabelEditor({ space, icon, onClose }: { space: Space; icon: ReactNode; onClose: () => void }) {
  const rename = useRenameSpace();
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-1 text-sm font-medium text-foreground">
      {icon}
      <InlineTitleInputComponent
        label={`Title of ${space.title}`}
        value={space.title}
        onSave={(title) => rename.mutate({ id: space.id, title })}
        onClose={onClose}
      />
    </div>
  );
}

function ReorderHandle({ title, sortable }: { title: string; sortable: Sortable }) {
  return (
    <button
      ref={sortable.setActivatorNodeRef}
      type="button"
      aria-label={`Drag ${title}`}
      {...sortable.attributes}
      {...sortable.listeners}
      className="absolute top-1.5 left-1.5 z-10 grid size-6 cursor-grab touch-none place-items-center rounded-md bg-accent text-muted-foreground opacity-0 focus-visible:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

// The floating copy of the row being dragged, with where it will go when that changes its folder or group.
function DragPreview({ space, destination }: { space: Space; destination?: string }) {
  const Icon = space.kind === 'folder' ? FolderIcon : (TOOL_ICONS[space.tool ?? 'list'] ?? TOOL_ICONS.list);
  return (
    <div className="flex cursor-grabbing items-center gap-2.5 rounded-lg bg-card px-2.5 py-2 text-sm font-medium text-foreground ring-2 ring-foreground/15">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{space.title}</span>
      {destination && (
        <span className="ml-auto shrink-0 truncate rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{destination}</span>
      )}
    </div>
  );
}

export const TOOL_ICONS: Record<SpaceTool, IconComponent> = {
  list: SpaceIcon,
  notebook: NotebookIcon,
  book: BookMarked,
  vault: VaultIcon,
  budget: BudgetIcon,
  fitness: Dumbbell,
  jobs: BriefcaseBusiness,
  diagram: Network,
  pipelines: Workflow,
  skills: ScrollText,
  uptime: Activity,
};

type SpaceRowProps = {
  space: Space;
  isActive: boolean;
  canDrag: boolean;
  nested?: boolean;
  renderSummary?: RenderSpaceSummary;
};

function SpaceRow({ space, isActive, canDrag, nested, renderSummary }: SpaceRowProps) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id: space.id, data: { kind: 'space', inOwnFolder: nested && isOwn(space) } });
  const Icon = TOOL_ICONS[space.tool ?? 'list'] ?? TOOL_ICONS.list;
  const icon = <Icon className="size-4 shrink-0" data-active={isActive || undefined} aria-hidden />;
  const startEditing = isOwn(space) ? () => setEditing(true) : undefined;

  return (
    <div
      ref={sortable.setNodeRef}
      style={dragStyle(sortable)}
      className={cn('group/row relative', nested && 'ml-4', canDrag && 'select-none', draggingClass(sortable))}
      {...dragFromRow(sortable, canDrag && !editing)}
    >
      {canDrag && !editing && <ReorderHandle title={space.title} sortable={sortable} />}
      <Tooltip delayDuration={300} open={renderSummary && space.tool === 'list' ? undefined : false}>
        <SpaceContextMenuComponent space={space} editing={editing} onEdit={() => setEditing(true)}>
          {editing ? (
            <div>
              <LabelEditor space={space} icon={icon} onClose={() => setEditing(false)} />
            </div>
          ) : (
            <TooltipTrigger asChild>
              <Link
                href={spaceHref(space)}
                draggable={false}
                aria-current={isActive ? 'page' : undefined}
                onDoubleClick={startEditing}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground hover:bg-accent',
                  nested && 'row-enter',
                  isActive && 'bg-muted text-foreground hover:bg-accent',
                )}
              >
                {icon}
                <span className="truncate">{space.title}</span>
                {space.shared && <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Shared" />}
                <OwnerName space={space} />
                <PipelineDotComponent space={space} />
                <UptimeDotComponent space={space} />
                {space.openToday > 0 && (
                  <span className={cn('ml-auto text-xs text-muted-foreground', isActive && 'text-foreground')}>
                    {space.openToday}
                  </span>
                )}
              </Link>
            </TooltipTrigger>
          )}
        </SpaceContextMenuComponent>
        <TooltipContent side="right" sideOffset={8} aria-label={`Today in ${space.title}`} className="w-60 p-3">
          {renderSummary?.(space)}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

type FolderRowProps = {
  folder: SpaceNode;
  activeId?: string;
  isOpen: boolean;
  canDrag: boolean;
  dropTarget: boolean;
  onToggle: () => void;
  onAddSpace: () => void;
  renderSummary?: RenderSpaceSummary;
};

function FolderRow({ folder, activeId, isOpen, canDrag, dropTarget, onToggle, onAddSpace, renderSummary }: FolderRowProps) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id: folder.id, data: { kind: 'folder' } });
  const own = isOwn(folder);
  const intoFolder = useDroppable({ id: `folder-drop:${folder.id}`, data: { folderId: folder.id }, disabled: !own });
  const Icon = isOpen || dropTarget ? FolderOpenIcon : FolderIcon;
  const icon = <Icon className="size-4 shrink-0" aria-hidden />;

  return (
    <div ref={sortable.setNodeRef} style={dragStyle(sortable)} className={cn('relative', draggingClass(sortable))}>
      <div className={cn('group/row relative', canDrag && 'select-none')} {...dragFromRow(sortable, canDrag && !editing)}>
        {canDrag && !editing && <ReorderHandle title={folder.title} sortable={sortable} />}
        {/* The middle of the header: a space dropped here goes into the folder; the edges still reorder around it. */}
        <span ref={intoFolder.setNodeRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-1/4 bottom-1/4" />
        <SpaceContextMenuComponent space={folder} editing={editing} onEdit={() => setEditing(true)}>
          {editing ? (
            <div>
              <LabelEditor space={folder} icon={icon} onClose={() => setEditing(false)} />
            </div>
          ) : (
            <div className={cn('flex items-center rounded-lg transition-colors hover:bg-accent', dropTarget && 'bg-muted ring-2 ring-foreground')}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={onToggle}
                onDoubleClick={own ? () => setEditing(true) : undefined}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-foreground"
              >
                {icon}
                <span className="truncate">{folder.title}</span>
                {folder.shared && <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Shared" />}
                <OwnerName space={folder} />
              </button>
              {own && (
                <button
                  type="button"
                  aria-label={`New space in ${folder.title}`}
                  onClick={onAddSpace}
                  className="mr-8 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          )}
        </SpaceContextMenuComponent>
      </div>
      {isOpen && (
        <SortableContext id={folder.id} items={folder.children.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
          {folder.children.map((child) => (
            <SpaceRow
              key={child.id}
              space={child}
              isActive={child.id === activeId}
              canDrag={own}
              nested
              renderSummary={renderSummary}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

export function SpacesNavComponent({ renderSpaceSummary }: { renderSpaceSummary?: RenderSpaceSummary }) {
  const { data = [], isPending: spacesPending } = useSpaces();
  const { data: groupData, isPending: groupsPending } = useSpaceGroups();
  const isPending = spacesPending || groupsPending;
  const spaces = isPending ? SAMPLE_SPACES : data;
  const groups = isPending || !groupData?.length ? SAMPLE_GROUPS : groupData;
  const active = useActiveSpace();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<CreatingState>();
  const reorder = useReorderSpaces();
  const moveToGroup = useMoveToGroup();
  const moveSpace = useMoveSpace();
  const [preview, setPreview] = useState<DropAction>();
  const [draggingId, setDraggingId] = useState<string>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const tree = buildOwnTree(spaces);
  const sharedTree = buildSharedTree(spaces);
  const nodesIn = (groupId: string) => tree.filter((node) => groupOf(node, groups) === groupId);

  const renderNodes = (nodes: SpaceNode[], canDrag: boolean) =>
    nodes.map((node) =>
      node.kind === 'space' ? (
        <SpaceRow
          key={node.id}
          space={node}
          isActive={node.id === active?.id}
          canDrag={canDrag}
          renderSummary={renderSpaceSummary}
        />
      ) : (
        <FolderRow
          key={node.id}
          folder={node}
          activeId={active?.id}
          isOpen={!collapsed.has(node.id)}
          canDrag={canDrag}
          dropTarget={preview?.kind === 'folder' && preview.parentId === node.id}
          onToggle={() => toggleFolder(node.id)}
          onAddSpace={() => setCreating({ kind: 'space', parentFolder: node })}
          renderSummary={renderSpaceSummary}
        />
      ),
    );

  const actionFor = ({ active, over }: Pick<DragEndEvent, 'active' | 'over'>) =>
    over ? dropAction(dropSide(active), dropSide(over), (groupId) => nodesIn(groupId).map(({ id }) => id)) : undefined;

  const dragging = spaces.find((space) => space.id === draggingId);
  const destination =
    preview?.kind === 'folder'
      ? `Into ${spaces.find((space) => space.id === preview.parentId)?.title ?? 'folder'}`
      : preview?.kind === 'group'
        ? `To ${groups.find((group) => group.id === preview.groupId)?.title ?? 'group'}`
        : undefined;

  function stopDragging() {
    setPreview(undefined);
    setDraggingId(undefined);
  }

  function handleDragEnd(event: DragEndEvent) {
    stopDragging();
    const action = actionFor(event);
    if (action?.kind === 'folder') moveSpace.mutate({ id: action.id, parentId: action.parentId });
    if (action?.kind === 'group') moveToGroup.mutate({ id: action.id, groupId: action.groupId, order: action.order });
    if (action?.kind === 'reorder') reorder.mutate(action.order);
  }

  function toggleFolder(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const close = () => setCreating(undefined);

  return (
    <>
      <DndContext
        id="spaces-nav"
        sensors={sensors}
        collisionDetection={sidebarCollision}
        modifiers={[keepRowVertical]}
        onDragStart={({ active }) => setDraggingId(String(active.id))}
        onDragOver={(event) => setPreview(actionFor(event))}
        onDragCancel={stopDragging}
        onDragEnd={handleDragEnd}
      >
        {groups.map((group) => {
          const nodes = nodesIn(group.id);
          const rows = renderNodes(nodes, !isPending);
          const lineAt = preview?.kind === 'group' && preview.groupId === group.id ? preview.order.indexOf(preview.id) : -1;
          return (
            <section key={group.id} aria-label={group.title}>
              <GroupHeading group={group} isTarget={lineAt !== -1} onAdd={(kind) => setCreating(group === SAMPLE_GROUPS[0] ? { kind } : { kind, groupId: group.id })} />
              <Skeleton loading={isPending} label="Loading spaces">
                <SortableContext id={GROUP_LIST + group.id} items={nodes.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
                  {lineAt === -1 ? rows : [...rows.slice(0, lineAt), DROP_LINE, ...rows.slice(lineAt)]}
                </SortableContext>
              </Skeleton>
            </section>
          );
        })}

        {sharedTree.length > 0 && (
          <>
            <div className="mx-2 mt-5 mb-1.5 text-[13px] font-medium text-muted-foreground">Shared with me</div>
            <SortableContext id="shared-spaces" items={sharedTree.map(({ id }) => id)}>
              {renderNodes(sharedTree, false)}
            </SortableContext>
          </>
        )}
        <DragOverlay modifiers={[keepRowVertical]} dropAnimation={null}>
          {dragging && <DragPreview space={dragging} destination={destination} />}
        </DragOverlay>
      </DndContext>

      <Dialog open={creating !== undefined} onOpenChange={(open) => !open && close()}>
        <DialogContent aria-describedby={undefined} className={creating?.kind === 'folder' ? 'sm:max-w-sm' : 'sm:max-w-2xl'}>
          <DialogHeader>
            <DialogTitle>{creating?.kind === 'folder' ? 'New folder' : 'New space'}</DialogTitle>
            {(creating?.parentFolder || groups.length > 1) && (
              <DialogDescription>In {creating?.parentFolder?.title ?? groups.find((group) => group.id === creating?.groupId)?.title}</DialogDescription>
            )}
          </DialogHeader>
          <CreateSpaceFormComponent
            key={creating?.kind}
            kind={creating?.kind}
            parentFolder={creating?.parentFolder}
            groupId={creating?.groupId}
            onDone={close}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
