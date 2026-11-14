'use client';

import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/utils/cn';
import { formatGrams, formatKcal } from './fitness-format';
import type { FoodLog } from './fitness-types';
import { formatQuantity } from './food-math';

type FoodLogRowProps = { log: FoodLog; onToggle: (eaten: boolean) => void; onOpen: () => void };

export function FoodLogRowComponent({ log, onToggle, onOpen }: FoodLogRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent">
      <Checkbox checked={log.eaten} onCheckedChange={(checked) => onToggle(checked === true)} aria-label={`Eaten: ${log.name}`} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('truncate text-sm font-medium', !log.eaten && 'text-muted-foreground')}>{log.name}</span>
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {formatQuantity(log)} · P {formatGrams(log.proteinMg)} · C {formatGrams(log.carbsMg)} · F {formatGrams(log.fatMg)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={cn('text-sm font-medium tabular-nums', !log.eaten && 'text-muted-foreground')}>{formatKcal(log.kcal)}</span>
          {!log.eaten && <span className="text-[11px] text-muted-foreground">Planned</span>}
        </span>
      </button>
    </li>
  );
}
