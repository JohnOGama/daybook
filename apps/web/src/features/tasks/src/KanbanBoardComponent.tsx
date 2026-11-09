'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { columnOf, KANBAN_COLUMNS, type KanbanColumnId } from './kanban-columns';
import { KanbanCardComponent, KanbanCardFace } from './KanbanCardComponent';
import { StatusIconComponent } from './StatusIconComponent';
import { TaskFormDialogComponent } from './TaskFormDialogComponent';
import type { Task } from './task-types';

const COLUMN_GAP = 12;

const stepAcrossColumns: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const [firstColumn] = context.droppableRects.values();
  if (!firstColumn) return undefined;
  const step = firstColumn.width + COLUMN_GAP;
  if (event.code === KeyboardCode.Right) return { ...currentCoordinates, x: currentCoordinates.x + step };
  if (event.code === KeyboardCode.Left) return { ...currentCoordinates, x: currentCoordinates.x - step };
  return undefined;
};

type KanbanColumnProps = { id: KanbanColumnId; label: string; tasks: Task[]; onOpen: (task: Task) => void };

function KanbanColumn({ id, label, tasks, onOpen }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn('flex min-h-0 flex-col rounded-2xl border bg-card transition-colors', isOver && 'border-ring')}
    >
      <h2 className="flex items-center justify-between px-3.5 py-2.5 text-[13px] font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <StatusIconComponent status={id} />
          {label}
        </span>
        <span className="tabular-nums">{tasks.length}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {tasks.map((task) => (
          <KanbanCardComponent key={task.id} task={task} onOpen={() => onOpen(task)} />
        ))}
      </ul>
    </section>
  );
}

export function KanbanBoardComponent({ tasks }: { tasks: Task[] }) {
  const { update, setFinished } = useTaskMutations();
  const [draggingId, setDraggingId] = useState<string>();
  const [editing, setEditing] = useState<Task>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: stepAcrossColumns }),
  );
  const dragging = tasks.find((task) => task.id === draggingId);

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(undefined);
    const task = tasks.find(({ id }) => id === active.id);
    const target = over?.id as KanbanColumnId | undefined;
    if (!task || !target || columnOf(task) === target) return;
    if (target === 'completed') setFinished.mutate({ id: task.id, finished: true });
    else if (task.finished) setFinished.mutate({ id: task.id, finished: false, status: target });
    else update.mutate({ id: task.id, input: { status: target } });
  }

  return (
    <>
      <DndContext
        id="kanban-board"
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={({ active }) => setDraggingId(String(active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(undefined)}
      >
        <div className="overflow-x-auto px-4 pb-4 md:h-full md:px-6">
          <div className="grid min-w-[880px] grid-cols-4 md:h-full md:grid-rows-[minmax(0,1fr)]" style={{ gap: COLUMN_GAP }}>
            {KANBAN_COLUMNS.map(({ id, label }) => (
              <KanbanColumn
                key={id}
                id={id}
                label={label}
                tasks={tasks.filter((task) => columnOf(task) === id)}
                onOpen={setEditing}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <KanbanCardFace
              task={dragging}
              className="shadow-lg"
              handle={<GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            />
          )}
        </DragOverlay>
      </DndContext>
      {editing && (
        <TaskFormDialogComponent
          mode="edit"
          task={editing}
          defaultDay={editing.day}
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
        />
      )}
    </>
  );
}
