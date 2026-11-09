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

  return (
    <div className="mx-4 mb-6 overflow-x-auto rounded-2xl border bg-card md:mx-6">
      <DndContext
        id="task-table"
        sensors={sensors}
        collisionDetection={withinSameList}
        modifiers={[keepRowInTable]}
        onDragStart={({ active }) => setDraggingId(String(active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(undefined)}
      >
        <table className="w-full table-fixed text-sm" style={{ minWidth: tableMinWidth(widths) }}>
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
          <thead className="bg-secondary text-left text-[13px] text-muted-foreground">
            <tr className="h-10 border-b">
              <th scope="col">
                <span className="sr-only">Reorder and expand</span>
              </th>
              <th scope="col">
                <span className="sr-only">Finished</span>
              </th>
              <th scope="col" className="font-medium">
                Task
              </th>
              <th scope="col" className="relative pl-3 font-medium">
                <ColumnResizerComponent
                  boundary={{ right: 'status' }}
                  label="Resize Task and Status columns"
                  widths={widths}
                  onChange={setWidths}
                />
                Status
              </th>
              <th scope="col" className="relative pl-3 font-medium">
                <ColumnResizerComponent
                  boundary={{ left: 'status', right: 'priority' }}
                  label="Resize Status and Priority columns"
                  widths={widths}
                  onChange={setWidths}
                />
                Priority
              </th>
              <th scope="col" className="relative pl-3 font-medium">
                <ColumnResizerComponent
                  boundary={{ left: 'priority', right: 'created' }}
                  label="Resize Priority and Created columns"
                  widths={widths}
                  onChange={setWidths}
                />
                Created
              </th>
              <th scope="col" className="relative pl-3 font-medium">
                <ColumnResizerComponent
                  boundary={{ left: 'created', right: 'completed' }}
                  label="Resize Created and Completed at columns"
                  widths={widths}
                  onChange={setWidths}
                />
                Completed at
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <SortableContext id="tasks" items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task) => {
                const expanded = !collapsed.has(task.id);
                return (
                  <Fragment key={task.id}>
                    <TaskRowComponent
                      task={task}
                      rowIndex={nextRowIndex()}
                      canReorder={tasks.length > 1}
                      expanded={expanded}
                      onToggleExpanded={() => toggle(task.id)}
                    />
                    {expanded && draggingId !== task.id && (
                      <SortableContext
                        id={task.id}
                        items={task.subtasks.map((subtask) => subtask.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {task.subtasks.map((subtask) => (
                          <TaskRowComponent
                            key={subtask.id}
                            task={subtask}
                            rowIndex={nextRowIndex()}
                            canReorder={task.subtasks.length > 1}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </Fragment>
                );
              })}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
    </div>
  );
}
