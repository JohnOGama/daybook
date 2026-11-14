'use client';

import { ClipboardList, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { SectionCardComponent } from '@/features/budget';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { addDays, relativeDayLabel } from '@/shared/utils/date-formatter';
import { useFitnessDays } from '../hooks/useFitnessDays';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { DaySwitcherComponent } from './DaySwitcherComponent';
import { formatKcal } from './fitness-format';
import { type FitnessViewProps, type Meal, MEAL_LABELS, MEALS } from './fitness-types';
import { dayTotals, plannedTotals, totalsOf } from './food-math';
import { intakeByDay } from './forecast-math';
import { StartWorkoutMenuComponent } from './FitnessWorkoutsComponent';
import { FoodLogRowComponent } from './FoodLogRowComponent';
import { type FoodSheetState, FoodSearchSheetComponent } from './FoodSearchSheetComponent';
import { IntakeWeekComponent } from './IntakeWeekComponent';
import { MacroMetersComponent } from './MacroMetersComponent';
import { MuscleMapCardComponent } from './MuscleMapCardComponent';
import { logsFromPlan, planFromLogs } from './plan-math';
import { sampleDay } from './sample-fitness';
import { targetsFor } from './targets-math';
import { WeightCardComponent } from './WeightCardComponent';
import { setsDone } from './workout-math';

function mealForNow(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export function FitnessTodayComponent(props: FitnessViewProps) {
  const { fitness, today, day, hrefFor } = props;
  const { data, isPending, isError } = useFitnessDays(addDays(day, -6), day);
  const { updateLog, addLogs, addMealPlan } = useFitnessMutations();
  const [sheet, setSheet] = useState<FoodSheetState>(null);
  const sample = useMemo(() => sampleDay(day), [day]);
  const week = data ?? sample;
  const logs = week.logs.filter((log) => log.day === day);
  const workouts = week.workouts.filter((workout) => workout.day === day);
  const targets = targetsFor(fitness.profile, fitness.weights.at(-1)?.weightG ?? null, today);

  return (
    <div className="flex flex-col gap-4">
      <DaySwitcherComponent day={day} today={today} hrefFor={hrefFor}>
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
        <StartWorkoutMenuComponent templates={fitness.templates} day={day} disabled={isPending} />
      </DaySwitcherComponent>

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load this day. Please try again.
        </p>
      ) : (
        <Skeleton loading={isPending} label="Loading the day">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <MacroMetersComponent totals={dayTotals(logs)} planned={plannedTotals(logs)} targets={targets} />
              {!targets && (
                <p className="text-sm text-muted-foreground">
                  <Link href={hrefFor({ view: 'settings' })} className="underline underline-offset-2 hover:text-foreground">
                    Set up your profile
                  </Link>{' '}
                  and add a weigh-in to get calorie and macro targets.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {MEALS.map((meal) => {
                  const rows = logs.filter((log) => log.meal === meal);
                  const eaten = totalsOf(rows.filter((log) => log.eaten));
                  return (
                    <SectionCardComponent
                      key={meal}
                      title={MEAL_LABELS[meal]}
                      action={
                        <span className="flex items-center gap-1">
                          {rows.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">{formatKcal(eaten.kcal)}</span>}
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Add food to ${MEAL_LABELS[meal]}`} onClick={() => setSheet({ mode: 'add', day, meal })}>
                            <Plus aria-hidden />
                          </Button>
                        </span>
                      }
                    >
                      {rows.length > 0 ? (
                        <ul className="px-2 pb-2">
                          {rows.map((log) => (
                            <FoodLogRowComponent
                              key={log.id}
                              log={log}
                              onToggle={(isEaten) => updateLog.mutate({ id: log.id, changes: { eaten: isEaten } })}
                              onOpen={() => setSheet({ mode: 'edit', log })}
                            />
                          ))}
                        </ul>
                      ) : (
                        <Button
                          variant="outline"
                          onClick={() => setSheet({ mode: 'add', day, meal })}
                          className="mx-4 mb-4 h-auto justify-start border-dashed py-3 font-normal text-muted-foreground"
                        >
                          Nothing logged yet
                        </Button>
                      )}
                    </SectionCardComponent>
                  );
                })}
              </div>

              <SectionCardComponent title="Workout">
                {workouts.length > 0 ? (
                  <ul className="flex flex-col gap-1 px-2 pb-2">
                    {workouts.map((workout) => {
                      const { done, total } = setsDone(workout);
                      return (
                        <li key={workout.id}>
                          <Link
                            href={hrefFor({ view: 'workouts' })}
                            className="flex flex-col gap-2 rounded-lg px-2 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="truncate font-medium">{workout.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {done} of {total} sets done
                              </span>
                            </span>
                            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-signal transition-[width] duration-500" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-4 pb-4 text-sm text-muted-foreground">No workout on this day. Start one from a template above.</p>
                )}
              </SectionCardComponent>
            </div>

            <aside aria-label="Your week" className="flex min-w-0 flex-col gap-4">
              <IntakeWeekComponent intake={intakeByDay(week.logs)} day={day} targetKcal={targets?.kcal ?? null} hrefFor={hrefFor} />
              <WeightCardComponent {...props} />
              <MuscleMapCardComponent workouts={week.workouts} day={day} />
            </aside>
          </div>
        </Skeleton>
      )}

      <FoodSearchSheetComponent state={sheet} onClose={() => setSheet(null)} />
    </div>
  );
}
