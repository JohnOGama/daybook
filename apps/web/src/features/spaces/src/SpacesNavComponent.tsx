'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
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
import { BookOpen, Lock, Folder, FolderOpen, GripVertical, Hash, Plus } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { InlineTitleInputComponent } from '@/shared/components/InlineTitleInputComponent';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils/cn';
import { withinSameList } from '@/shared/utils/within-same-list';
import { useActiveSpace } from '../hooks/useActiveSpace';
import { useRenameSpace } from '../hooks/useRenameSpace';
import { useReorderSpaces } from '../hooks/useReorderSpaces';
import { useSpaces } from '../hooks/useSpaces';
import { CreateSpaceFormComponent } from './CreateSpaceFormComponent';
import { SpaceContextMenuComponent } from './SpaceContextMenuComponent';
import { buildSpaceTree, type SpaceNode, spaceHref } from './space-tree';
import type { Space, SpaceTool } from './space-types';

type CreatingState = { parentFolder?: Space };
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
  createdAt: '',
  openToday: 0,
}));

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

const TOOL_ICONS: Record<SpaceTool, typeof Hash> = { list: Hash, notebook: BookOpen, vault: Lock };

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
  const icon = <Icon className="size-4 shrink-0" aria-hidden />;

  return (
    <div
      ref={sortable.setNodeRef}
      style={dragStyle(sortable)}
      className={cn('group/row relative', nested && 'ml-4', draggingClass(sortable))}
    >
      {canReorder && !editing && <ReorderHandle title={space.title} sortable={sortable} />}
      <Tooltip delayDuration={300} open={renderSummary && space.tool === 'list' ? undefined : false}>
        <SpaceContextMenuComponent space={space} onEdit={() => setEditing(true)}>
          {editing ? (
            <div>
              <LabelEditor space={space} icon={icon} onClose={() => setEditing(false)} />
            </div>
          ) : (
            <TooltipTrigger asChild>
              <Link
                href={spaceHref(space)}
                aria-current={isActive ? 'page' : undefined}
                onDoubleClick={() => setEditing(true)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground hover:bg-accent',
                  nested && 'row-enter',
                  isActive && 'bg-muted text-foreground hover:bg-accent',
                )}
              >
                {icon}
                <span className="truncate">{space.title}</span>
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
  const Icon = isOpen ? FolderOpen : Folder;
  const icon = <Icon className="size-4 shrink-0" aria-hidden />;

  return (
    <div ref={sortable.setNodeRef} style={dragStyle(sortable)} className={cn('relative', draggingClass(sortable))}>
      <div className="group/row relative">
        {canReorder && !editing && <ReorderHandle title={folder.title} sortable={sortable} />}
        <SpaceContextMenuComponent space={folder} onEdit={() => setEditing(true)}>
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
                onDoubleClick={() => setEditing(true)}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-sm font-medium text-foreground"
              >
                {icon}
                <span className="truncate">{folder.title}</span>
              </button>
              <button
                type="button"
                aria-label={`New space in ${folder.title}`}
                onClick={onAddSpace}
                className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
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
              canReorder={folder.children.length > 1}
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
  const { data = [], isPending } = useSpaces();
  const spaces = isPending ? SAMPLE_SPACES : data;
  const active = useActiveSpace();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<CreatingState>();
  const reorder = useReorderSpaces();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const tree = buildSpaceTree(spaces);
  const canReorder = !isPending && tree.length > 1;

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
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
      <div className="mx-2 mt-5 mb-1.5 flex items-center justify-between text-[13px] font-medium text-muted-foreground">
        Spaces
        <button
          type="button"
          aria-label="New space"
          onClick={() => setCreating({})}
          className="grid size-6 place-items-center rounded-md border bg-card text-muted-foreground hover:bg-accent"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>

      <DndContext
        id="spaces-nav"
        sensors={sensors}
        collisionDetection={withinSameList}
        modifiers={[keepRowVertical]}
        onDragEnd={handleDragEnd}
      >
        <Skeleton loading={isPending} label="Loading spaces">
          <SortableContext id="spaces" items={tree.map(({ id }) => id)} strategy={verticalListSortingStrategy}>
            {tree.map((node) =>
              node.kind === 'space' ? (
                <SpaceRow
                  key={node.id}
                  space={node}
                  isActive={node.id === active?.id}
                  canReorder={canReorder}
                  renderSummary={renderSpaceSummary}
                />
              ) : (
                <FolderRow
                  key={node.id}
                  folder={node}
                  activeId={active?.id}
                  isOpen={!collapsed.has(node.id)}
                  canReorder={canReorder}
                  onToggle={() => toggleFolder(node.id)}
                  onAddSpace={() => setCreating({ parentFolder: node })}
                  renderSummary={renderSpaceSummary}
                />
              ),
            )}
          </SortableContext>
        </Skeleton>
      </DndContext>

      <Dialog open={creating !== undefined} onOpenChange={(open) => !open && close()}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New space</DialogTitle>
            {creating?.parentFolder && <DialogDescription>In {creating.parentFolder.title}</DialogDescription>}
          </DialogHeader>
          <CreateSpaceFormComponent
            allowFolder={!creating?.parentFolder}
            parentFolder={creating?.parentFolder}
            onDone={close}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
