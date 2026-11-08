'use client';

import { Fragment, useState } from 'react';
import { TaskRowComponent } from './TaskRowComponent';
import type { Task } from './task-types';

export function TaskTableComponent({ tasks }: { tasks: Task[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] table-fixed text-sm">
        <thead className="bg-sidebar text-left text-[13px] text-slate-600">
          <tr className="h-10">
            <th scope="col" className="w-12">
              <span className="sr-only">Expand</span>
            </th>
            <th scope="col" className="w-7">
              <span className="sr-only">Finished</span>
            </th>
            <th scope="col" className="font-medium">
              Task
            </th>
            <th scope="col" className="w-28 font-medium">
              Status
            </th>
            <th scope="col" className="w-24 font-medium">
              Priority
            </th>
            <th scope="col" className="w-20 font-medium">
              Created
            </th>
            <th scope="col" className="w-12">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const expanded = !collapsed.has(task.id);
            return (
              <Fragment key={task.id}>
                <TaskRowComponent
                  task={task}
                  expanded={expanded}
                  onToggleExpanded={() => toggle(task.id)}
                />
                {expanded &&
                  task.subtasks.map((subtask) => (
                    <TaskRowComponent key={subtask.id} task={subtask} />
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
