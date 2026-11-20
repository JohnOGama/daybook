'use client';

import {
  closestCenter,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useDroppable,
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
import { BookMarked, BriefcaseBusiness, Dumbbell, GripVertical, Network, Plus, Users, Workflow } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
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
import { withinSameList } from '@/shared/utils/within-same-list';
import { useActiveSpace } from '../hooks/useActiveSpace';
import { useRenameSpace } from '../hooks/useRenameSpace';
import { useReorderSpaces } from '../hooks/useReorderSpaces';
import { useMoveToGroup, useSpaceGroups } from '../hooks/useSpaceGroups';
import { useSpaces } from '../hooks/useSpaces';
import { CreateSpaceFormComponent } from './CreateSpaceFormComponent';
import { PipelineDotComponent } from './PipelineDotComponent';
import { SpaceContextMenuComponent } from './SpaceContextMenuComponent';
import { groupOf } from './space-cache';
import { buildOwnTree, buildSharedTree, isOwn, type SpaceNode, spaceHref } from './space-tree';
import type { Space, SpaceGroup, SpaceTool } from './space-types';

type CreatingState = { kind: Space['kind']; parentFolder?: Space; groupId?: string };

const SAMPLE_GROUPS: SpaceGroup[] = [{ id: 'sample-group', title: 'Spaces' }];
const GROUP_LIST = 'group-';

// Top-level rows can be dropped on another group's rows or heading; everything else stays in its own list.
const withinGroups: CollisionDetection = (args) => {
  const list = String(args.active.data.current?.sortable?.containerId ?? '');
  if (!list.startsWith(GROUP_LIST)) return withinSameList(args);
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => String(container.data.current?.sortable?.containerId ?? '').startsWith(GROUP_LIST) || container.data.current?.groupId,
    ),
  });
};

// A group's heading: its name, and the + (shown on hover) that offers a new space or folder in it. Rows can be dropped on it.
function GroupHeading({ group, onAdd }: { group: SpaceGroup; onAdd: (kind: Space['kind']) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-drop:${group.id}`, data: { groupId: group.id } });
  return (
    <div
      ref={setNodeRef}
      className={cn('group/heading mx-2 mt-5 mb-1.5 flex items-center justify-between rounded-md text-[13px] font-medium text-muted-foreground', isOver && 'bg-accent text-foreground')}
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
const draggingClass = ({ isDragging }: Sortable) => isDragging && 'z-20 rounded-lg bg-accent';

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
      aria-label={`Reorder ${title}`}
      {...sortable.attributes}
      {...sortable.listeners}
      className="absolute top-1.5 left-1.5 z-10 grid size-6 cursor-grab touch-none place-items-center rounded-md bg-accent text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
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
};

type SpaceRowProps = {
  space: Space;
  isActive: boolean;
  canReorder: boolean;
  nested?: boolean;
  renderSummary?: RenderSpaceSummary;
};

function SpaceRow({ space, isActive, canReorder, nested, renderSummary }: SpaceRowProps) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id: space.id });
  const Icon = TOOL_ICONS[space.tool ?? 'list'];
  const icon = <Icon className="size-4 shrink-0" data-active={isActive || undefined} aria-hidden />;
  const startEditing = isOwn(space) ? () => setEditing(true) : undefined;

  return (
    <div
      ref={sortable.setNodeRef}
      style={dragStyle(sortable)}
      className={cn('group/row relative', nested && 'ml-4', draggingClass(sortable))}
    >
      {canReorder && !editing && <ReorderHandle title={space.title} sortable={sortable} />}
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
  canReorder: boolean;
  onToggle: () => void;
  onAddSpace: () => void;
  renderSummary?: RenderSpaceSummary;
};

function FolderRow({ folder, activeId, isOpen, canReorder, onToggle, onAddSpace, renderSummary }: FolderRowProps) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id: folder.id });
  const Icon = isOpen ? FolderOpenIcon : FolderIcon;
  const icon = <Icon className="size-4 shrink-0" aria-hidden />;
  const own = isOwn(folder);

  return (
    <div ref={sortable.setNodeRef} style={dragStyle(sortable)} className={cn('relative', draggingClass(sortable))}>
      <div className="group/row relative">
        {canReorder && !editing && <ReorderHandle title={folder.title} sortable={sortable} />}
        <SpaceContextMenuComponent space={folder} editing={editing} onEdit={() => setEditing(true)}>
          {editing ? (
            <div>
              <LabelEditor space={folder} icon={icon} onClose={() => setEditing(false)} />
            </div>
          ) : (
            <div className="flex items-center rounded-lg hover:bg-accent">
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
              canReorder={own && folder.children.length > 1}
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const tree = buildOwnTree(spaces);
  const sharedTree = buildSharedTree(spaces);
  const nodesIn = (groupId: string) => tree.filter((node) => groupOf(node, groups) === groupId);

  const renderNodes = (nodes: SpaceNode[], canReorderNodes: boolean) =>
    nodes.map((node) =>
      node.kind === 'space' ? (
        <SpaceRow
          key={node.id}
          space={node}
          isActive={node.id === active?.id}
          canReorder={canReorderNodes}
          renderSummary={renderSpaceSummary}
        />
      ) : (
        <FolderRow
          key={node.id}
          folder={node}
          activeId={active?.id}
          isOpen={!collapsed.has(node.id)}
          canReorder={canReorderNodes}
          onToggle={() => toggleFolder(node.id)}
          onAddSpace={() => setCreating({ kind: 'space', parentFolder: node })}
          renderSummary={renderSpaceSummary}
        />
      ),
    );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = String(active.data.current?.sortable?.containerId ?? '');
    const overList = String(over.data.current?.sortable?.containerId ?? '');
    const target: string | undefined = over.data.current?.groupId ?? (overList.startsWith(GROUP_LIST) ? overList.slice(GROUP_LIST.length) : undefined);
    if (from.startsWith(GROUP_LIST) && target && from !== GROUP_LIST + target) {
      const ids = nodesIn(target).map(({ id }) => id);
      const at = over.data.current?.sortable ? ids.indexOf(String(over.id)) : ids.length;
      moveToGroup.mutate({ id: String(active.id), groupId: target, order: [...ids.slice(0, at), String(active.id), ...ids.slice(at)] });
      return;
    }
    if (over.data.current?.groupId) return;
    const ids: string[] = active.data.current?.sortable.items;
    reorder.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
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
        collisionDetection={withinGroups}
        modifiers={[keepRowVertical]}
        onDragEnd={handleDragEnd}
      >
        {groups.map((group) => {
          const nodes = nodesIn(group.id);
          return (
            <section key={group.id} aria-label={group.title}>
              <GroupHeading group={group} onAdd={(kind) => setCreating(group === SAMPLE_GROUPS[0] ? { kind } : { kind, groupId: group.id })} />
              <Skeleton loading={isPending} label="Loading spaces">
                <SortableContext id={GROUP_LIST + group.id} items={nodes.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
                  {renderNodes(nodes, !isPending && nodes.length > 1)}
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
