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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Fragment, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { withinSameList } from '@/shared/utils/within-same-list';
import { useColumnWidths } from '../hooks/useColumnWidths';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { ColumnResizerComponent } from './ColumnResizerComponent';
import { tableMinWidth } from './task-columns';
import { moveId, siblingIds } from './task-order';
import { TaskRowComponent } from './TaskRowComponent';
import type { Task } from './task-types';

const MAX_STAGGERED_ROWS = 12;

// The table wrapper scrolls sideways, which also makes it scroll vertically if a row is dragged past its edge.
export const keepRowInTable: Modifier = ({ transform, draggingNodeRect: row, containerNodeRect: rows }) => ({
  ...transform,
  x: 0,
  y: row && rows ? Math.min(Math.max(transform.y, rows.top - row.top), rows.bottom - row.bottom) : transform.y,
});

export function TaskTableComponent({ tasks, allTasks }: { tasks: Task[]; allTasks: Task[] }) {
  const { reorder } = useTaskMutations();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string>();
  // ponytail: every drag step re-renders all rows; move widths to CSS variables if a day ever holds hundreds of tasks
  const [widths, setWidths] = useColumnWidths();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(undefined);
    if (!over || active.id === over.id) return;
    reorder.mutate(moveId(siblingIds(allTasks, String(active.id)), String(active.id), String(over.id)));
  }

  let rowCount = 0;
  const nextRowIndex = () => Math.min(rowCount++, MAX_STAGGERED_ROWS);

  function renderRows(rows: Task[], listId: string, depth: number) {
    return (
      <SortableContext id={listId} items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        {rows.map((task) => {
          const expanded = !collapsed.has(task.id);
          return (
            <Fragment key={task.id}>
              <TaskRowComponent
                task={task}
                depth={depth}
                rowIndex={nextRowIndex()}
                canReorder={rows.length > 1}
                expanded={expanded}
                onToggleExpanded={() => toggle(task.id)}
              />
              {expanded && draggingId !== task.id && task.subtasks.length > 0 && renderRows(task.subtasks, task.id, depth + 1)}
            </Fragment>
          );
        })}
      </SortableContext>
    );
  }

  return (
    <div className="mx-4 mb-6 overflow-hidden rounded-lg border md:mx-6">
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
                  boundary={{ left: 'priority', right: 'created' }}
                  label="Resize Priority and Created columns"
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
          <TableBody>{renderRows(tasks, 'tasks', 0)}</TableBody>
        </Table>
      </DndContext>
    </div>
  );
}
