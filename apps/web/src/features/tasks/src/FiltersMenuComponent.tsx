'use client';

import { ListFilter } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { STATUS_LABELS, STATUSES } from './task-types';

export function FiltersMenuComponent() {
  const { filters, toggleStatus, toggleHigh } = useTaskFilters();
  const activeCount = filters.statuses.length + (filters.high ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter aria-hidden />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-48 flex-col gap-3">
        {STATUSES.map((status) => (
          <div key={status} className="flex items-center gap-2">
            <Checkbox
              id={`filter-${status}`}
              checked={filters.statuses.includes(status)}
              onCheckedChange={() => toggleStatus(status)}
            />
            <Label htmlFor={`filter-${status}`}>{STATUS_LABELS[status]}</Label>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-3">
          <Checkbox id="filter-high" checked={filters.high} onCheckedChange={toggleHigh} />
          <Label htmlFor="filter-high">High priority</Label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
