'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Fragment, memo, useMemo, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { keepRowInTable } from '@/shared/utils/keep-row-in-table';
import { withinSameList } from '@/shared/utils/within-same-list';
import { useCollapsedTasks } from '../hooks/useCollapsedTasks';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { useInfiniteCount } from '../hooks/useInfiniteCount';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { ColumnResizerComponent } from './ColumnResizerComponent';
import { tableMinWidth } from './task-columns';
import { moveId, siblingIds } from './task-order';
import { TaskRowComponent } from './TaskRowComponent';
import type { Task } from './task-types';

const MAX_STAGGERED_ROWS = 10;


type TaskRowsProps = {
  rows: Task[];
  listId: string;
  depth: number;
  collapsed: Set<string>;
  draggingId?: string;
  onToggle: (id: string) => void;
  canEdit: boolean;
};

const TaskRows = memo(function TaskRows({ rows, listId, depth, collapsed, draggingId, onToggle, canEdit }: TaskRowsProps) {
  const idList = rows.map((row) => row.id).join();
  const items = useMemo(() => idList.split(','), [idList]);

  return (
    <SortableContext id={listId} items={items} strategy={verticalListSortingStrategy}>
      {rows.map((task, index) => {
        const expanded = !collapsed.has(task.id);
        return (
          <Fragment key={task.id}>
            <TaskRowComponent
              task={task}
              depth={depth}
              enterIndex={depth === 0 && index < MAX_STAGGERED_ROWS ? index : undefined}
              canReorder={canEdit && rows.length > 1}
              canEdit={canEdit}
              expanded={expanded}
              onToggleExpanded={onToggle}
            />
            {expanded && draggingId !== task.id && task.subtasks.length > 0 && (
              <TaskRows
                rows={task.subtasks}
                listId={task.id}
                depth={depth + 1}
                collapsed={collapsed}
                draggingId={draggingId}
                onToggle={onToggle}
                canEdit={canEdit}
              />
            )}
          </Fragment>
        );
      })}
    </SortableContext>
  );
});

export function TaskTableComponent({
  tasks,
  allTasks,
  canEdit = true,
}: {
  tasks: Task[];
  allTasks: Task[];
  canEdit?: boolean;
}) {
  const { reorder } = useTaskMutations();
  const [collapsed, toggle] = useCollapsedTasks();
  const [draggingId, setDraggingId] = useState<string>();
  const [widths, setWidths] = useColumnWidths();
  const [shownCount, endRef] = useInfiniteCount(tasks.length, draggingId !== undefined);
  const shownTasks = useMemo(() => tasks.slice(0, shownCount), [tasks, shownCount]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(undefined);
    if (!over || active.id === over.id) return;
    reorder.mutate(moveId(siblingIds(allTasks, String(active.id)), String(active.id), String(over.id)));
  }

  return (
    <div className="mx-4 mb-6 md:mx-6">
      <div className="overflow-hidden rounded-lg border">
        <DndContext
          id="task-table"
          sensors={sensors}
          collisionDetection={withinSameList}
          modifiers={[keepRowInTable]}
          onDragStart={({ active }) => setDraggingId(String(active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(undefined)}
        >
          <Table className="table-fixed" style={{ minWidth: tableMinWidth(widths) }}>
            <colgroup>
              <col className="w-14" />
              <col className="w-7" />
              <col />
              <col style={{ width: widths.status }} />
              <col style={{ width: widths.priority }} />
              <col style={{ width: widths.due }} />
              <col style={{ width: widths.created }} />
              <col style={{ width: widths.completed }} />
              <col className="w-12" />
            </colgroup>
            <TableHeader className="bg-muted">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">
                  <span className="sr-only">Reorder and expand</span>
                </TableHead>
                <TableHead scope="col">
                  <span className="sr-only">Finished</span>
                </TableHead>
                <TableHead scope="col" className="px-0">
                  Task
                </TableHead>
                <TableHead scope="col" className="relative px-3">
                  <ColumnResizerComponent
                    boundary={{ right: 'status' }}
                    label="Resize Task and Status columns"
                    widths={widths}
                    onChange={setWidths}
                  />
                  Status
                </TableHead>
                <TableHead scope="col" className="relative px-3">
                  <ColumnResizerComponent
                    boundary={{ left: 'status', right: 'priority' }}
                    label="Resize Status and Priority columns"
                    widths={widths}
                    onChange={setWidths}
                  />
                  Priority
                </TableHead>
                <TableHead scope="col" className="relative px-3">
                  <ColumnResizerComponent
                    boundary={{ left: 'priority', right: 'due' }}
                    label="Resize Priority and Due columns"
                    widths={widths}
                    onChange={setWidths}
                  />
                  Due
                </TableHead>
                <TableHead scope="col" className="relative px-3">
                  <ColumnResizerComponent
                    boundary={{ left: 'due', right: 'created' }}
                    label="Resize Due and Created columns"
                    widths={widths}
                    onChange={setWidths}
                  />
                  Created
                </TableHead>
                <TableHead scope="col" className="relative px-3">
                  <ColumnResizerComponent
                    boundary={{ left: 'created', right: 'completed' }}
                    label="Resize Created and Completed at columns"
                    widths={widths}
                    onChange={setWidths}
                  />
                  Completed at
                </TableHead>
                <TableHead scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TaskRows rows={shownTasks} listId="tasks" depth={0} collapsed={collapsed} draggingId={draggingId} onToggle={toggle} canEdit={canEdit} />
            </TableBody>
          </Table>
        </DndContext>
      </div>
      <div ref={endRef} aria-hidden />
    </div>
  );
}
