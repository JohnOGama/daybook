'use client';

import { ClipboardList, Dumbbell, GlassWater, Plus, Weight as WeightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { addDays, relativeDayLabel } from '@/shared/utils/date-formatter';
import { useFitnessDays } from '../hooks/useFitnessDays';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { formatKg } from './fitness-format';
import { type FitnessViewProps, type Meal, WATER_GOAL } from './fitness-types';
import { dayTotals, plannedTotals } from './food-math';
import { intakeByDay } from './forecast-math';
import { type FoodSheetState, FoodSearchSheetComponent } from './FoodSearchSheetComponent';
import { MacroMetersComponent, type QuickStat } from './MacroMetersComponent';
import { MealsCardComponent } from './MealsCardComponent';
import { logsFromPlan, planFromLogs } from './plan-math';
import { sampleDay } from './sample-fitness';
import { targetsFor } from './targets-math';
import { TodayWorkoutCardComponent } from './TodayWorkoutCardComponent';
import { WaterCardComponent } from './WaterCardComponent';
import { WeightCardComponent } from './WeightCardComponent';
import { WeekStripComponent } from './WeekStripComponent';
import { setsDone } from './workout-math';

const STAT_ICON = 'size-4 shrink-0 text-muted-foreground';

function mealForNow(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function FitnessTodayComponent(props: FitnessViewProps) {
  const { fitness, today, day, hrefFor, canEdit = true } = props;
  const { data, isPending, isError } = useFitnessDays(addDays(day, -6), day);
  const { addLogs, addMealPlan } = useFitnessMutations();
  const [sheet, setSheet] = useState<FoodSheetState>(null);
  const sample = useMemo(() => sampleDay(day), [day]);
  const week = data ?? sample;
  const logs = week.logs.filter((log) => log.day === day);
  const workouts = week.workouts.filter((workout) => workout.day === day);
  const targets = targetsFor(fitness.profile, fitness.weights.at(-1)?.weightG ?? null, today);
  const yesterday = addDays(day, -1);

  const glasses = week.water.find((water) => water.day === day)?.glasses ?? 0;
  const sets = workouts.map(setsDone).reduce((sum, { done, total }) => ({ done: sum.done + done, total: sum.total + total }), { done: 0, total: 0 });
  const weighIn = fitness.weights.filter((weight) => weight.day <= day).at(-1);
  const stats: QuickStat[] = [
    { icon: <GlassWater className={STAT_ICON} aria-hidden />, label: 'Water', value: `${glasses} / ${WATER_GOAL}` },
    { icon: <Dumbbell className={STAT_ICON} aria-hidden />, label: 'Workout', value: sets.total > 0 ? `${sets.done} / ${sets.total} sets` : 'None' },
    { icon: <WeightIcon className={STAT_ICON} aria-hidden />, label: 'Weight', value: weighIn ? formatKg(weighIn.weightG) : '—' },
  ];

  return (
    <div className="flex flex-col gap-4 xl:min-h-0 xl:flex-1">
      <WeekStripComponent day={day} today={today} intake={intakeByDay(week.logs)} targetKcal={targets?.kcal ?? null} hrefFor={hrefFor}>
        {canEdit && (
          <>
            <Button size="sm" disabled={isPending} onClick={() => setSheet({ mode: 'add', day, meal: mealForNow() })}>
              <Plus aria-hidden />
              Log food
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isPending}>
                  <ClipboardList aria-hidden />
                  Meal plan
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {fitness.mealPlans.map((plan) => (
                  <DropdownMenuItem key={plan.id} onSelect={() => addLogs.mutate(logsFromPlan(plan, day, () => crypto.randomUUID()))}>
                    Apply “{plan.name}”
                  </DropdownMenuItem>
                ))}
                {fitness.mealPlans.length === 0 && <DropdownMenuItem disabled>No meal plans yet. Make one in Library.</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={logs.length === 0}
                  onSelect={() => {
                    addMealPlan.mutate(planFromLogs(`Plan from ${relativeDayLabel(day, today)}`, logs, () => crypto.randomUUID()));
                    toast.success('Saved as a meal plan. Rename it in Library.');
                  }}
                >
                  Save this day as a plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </WeekStripComponent>

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load this day. Please try again.
        </p>
      ) : (
        <Skeleton loading={isPending} label="Loading the day" className="xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          {/* One column on phones in reading order (summary, meals, workout, water, weight). On large screens the workout
              card is the right-hand column beside meals, water and weight. On extra-large ones it runs the full height on
              the far right, beside the summary and Meals | Water and weight, and every column scrolls inside itself. */}
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_20rem_minmax(24rem,0.9fr)] xl:grid-rows-[auto_minmax(0,1fr)] xl:items-stretch">
            <MacroMetersComponent
              className="lg:col-span-2 lg:row-start-1 xl:col-start-1 xl:row-start-1"
              totals={dayTotals(logs)}
              planned={plannedTotals(logs)}
              targets={targets}
              stats={stats}
            />
            <MealsCardComponent
              className="lg:col-start-1 lg:row-start-2"
              day={day}
              logs={logs}
              yesterday={week.logs.filter((log) => log.day === yesterday)}
              canEdit={canEdit}
              onAdd={(meal) => setSheet({ mode: 'add', day, meal })}
              onOpen={(log) => setSheet({ mode: 'edit', log })}
            />
            <TodayWorkoutCardComponent
              workouts={week.workouts}
              templates={fitness.templates}
              day={day}
              hrefFor={hrefFor}
              canEdit={canEdit}
              className="lg:col-start-2 lg:row-span-2 lg:row-start-2 xl:col-start-3 xl:row-start-1"
            />
            <aside
              aria-label="Water and weight"
              className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-3 xl:col-start-2 xl:row-start-2 xl:min-h-0 xl:overflow-y-auto"
            >
              <WaterCardComponent day={day} glasses={glasses} canEdit={canEdit} />
              <WeightCardComponent {...props} />
            </aside>
          </div>
        </Skeleton>
      )}

      {canEdit && <FoodSearchSheetComponent state={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
