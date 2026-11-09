'use client';

import { ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { useToday } from '@/shared/hooks/useToday';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { useTasks } from '../hooks/useTasks';
import { sidebarCounts } from './day-summary';
import { StatusIconComponent } from './StatusIconComponent';
import { STATUS_LABELS, STATUSES, type TaskStatus } from './task-types';

type FilterOptionProps = {
  id: string;
  label: ReactNode;
  count: number;
  isSelected: boolean;
  onChange: () => void;
};

function FilterOption({ id, label, count, isSelected, onChange }: FilterOptionProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={isSelected} onCheckedChange={onChange} />
      <Label htmlFor={id} className="flex-1">
        {label} <span className="ml-auto text-xs font-normal text-muted-foreground">{count}</span>
      </Label>
    </div>
  );
}

export function FiltersMenuComponent() {
  const today = useToday();
  const { data: tasks = [] } = useTasks({ from: today, to: today });
  const { filters, toggleStatus, toggleHigh } = useTaskFilters();
  const activeCount = filters.statuses.length + (filters.high ? 1 : 0);
  const counts = sidebarCounts(tasks);
  const statusCounts: Record<TaskStatus, number> = {
    todo: counts.todo,
    in_progress: counts.inProgress,
    on_hold: counts.onHold,
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <ListFilter aria-hidden />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-52 flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground">Status</p>
        {STATUSES.map((status) => (
          <FilterOption
            key={status}
            id={`filter-${status}`}
            label={
              <>
                <StatusIconComponent status={status} />
                {STATUS_LABELS[status]}
              </>
            }
            count={statusCounts[status]}
            isSelected={filters.statuses.includes(status)}
            onChange={() => toggleStatus(status)}
          />
        ))}
        <p className="border-t pt-3 text-xs font-medium text-muted-foreground">Priority</p>
        <FilterOption
          id="filter-high"
          label="High priority"
          count={counts.high}
          isSelected={filters.high}
          onChange={toggleHigh}
        />
      </PopoverContent>
    </Popover>
  );
}
