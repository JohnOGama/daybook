'use client';

import { Copy, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { formatKcal } from './fitness-format';
import { type FoodLog, type Meal, MEAL_LABELS, MEALS } from './fitness-types';
import { totalsOf } from './food-math';
import { FoodLogRowComponent } from './FoodLogRowComponent';

type MealsCardProps = {
  day: string;
  logs: FoodLog[];
  // Yesterday's rows, so an empty meal can take what was eaten then.
  yesterday: FoodLog[];
  canEdit: boolean;
  onAdd: (meal: Meal) => void;
  onOpen: (log: FoodLog) => void;
  className?: string;
};

// The day's four meals in one list. An empty meal is a single line, with yesterday's food one tap away.
export function MealsCardComponent({ day, logs, yesterday, canEdit, onAdd, onOpen, className }: MealsCardProps) {
  const { updateLog, addLogs, removeLog } = useFitnessMutations();

  // Most meals repeat, so an empty meal can take yesterday's eaten food in one tap (with Undo).
  function copyYesterday(meal: Meal, rows: FoodLog[]) {
    const copies = rows.map(({ id: _id, day: _day, ...row }) => ({ ...row, id: crypto.randomUUID(), day, eaten: true }));
    addLogs.mutate(copies);
    const undo = () => copies.forEach((copy) => removeLog.mutate(copy.id));
    toast(`Copied ${copies.length} ${copies.length === 1 ? 'food' : 'foods'} to ${MEAL_LABELS[meal]}`, { action: { label: 'Undo', onClick: undo } });
  }

  const eatenKcal = totalsOf(logs.filter((log) => log.eaten)).kcal;

  return (
    <section aria-label="Meals" className={cn('flex min-w-0 flex-col rounded-xl border bg-card xl:min-h-0 xl:overflow-y-auto', className)}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <h2 className="text-[15px] font-semibold">Meals</h2>
        {logs.length > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatKcal(eatenKcal)} eaten</span>}
      </div>
      {MEALS.map((meal, index) => {
        const rows = logs.filter((log) => log.meal === meal);
        const fromYesterday = yesterday.filter((log) => log.meal === meal && log.eaten);
        return (
          <div key={meal} className={cn('px-2 pb-2', index > 0 && 'border-t pt-2')}>
            <div className="flex items-center gap-2 py-1 pr-1 pl-2">
              <h3 className="text-sm font-semibold">{MEAL_LABELS[meal]}</h3>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{rows.length > 0 ? formatKcal(totalsOf(rows.filter((log) => log.eaten)).kcal) : 'Nothing yet'}</span>
              {canEdit && (
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Add food to ${MEAL_LABELS[meal]}`} onClick={() => onAdd(meal)}>
                  <Plus aria-hidden />
                </Button>
              )}
            </div>
            {rows.length > 0 ? (
              <ul>
                {rows.map((log) => (
                  <FoodLogRowComponent
                    key={log.id}
                    log={log}
                    canEdit={canEdit}
                    onToggle={(isEaten) => updateLog.mutate({ id: log.id, changes: { eaten: isEaten } })}
                    onOpen={() => onOpen(log)}
                  />
                ))}
              </ul>
            ) : (
              canEdit &&
              fromYesterday.length > 0 && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => copyYesterday(meal, fromYesterday)}>
                  <Copy aria-hidden />
                  Same as yesterday · {fromYesterday.length} {fromYesterday.length === 1 ? 'food' : 'foods'}, {formatKcal(totalsOf(fromYesterday).kcal)}
                </Button>
              )
            )}
          </div>
        );
      })}
    </section>
  );
}
