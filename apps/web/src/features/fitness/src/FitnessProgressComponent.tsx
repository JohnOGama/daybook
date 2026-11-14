'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { SectionCardComponent, StatTileComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { addDays, formatShortDay } from '@/shared/utils/date-formatter';
import { useFitnessDays } from '../hooks/useFitnessDays';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { BodyDiagramComponent, strengthFromLoad } from './BodyDiagramComponent';
import { formatGrams, formatKcal, formatKg, parseAmount } from './fitness-format';
import type { FitnessViewProps, Targets } from './fitness-types';
import { averageIntake, forecast, intakeByDay, measuredDailyKcal, planGPerDay, smoothed, trendForecastGPerDay, trendGPerDay } from './forecast-math';
import { ForecastChartComponent } from './ForecastChartComponent';
import { FitnessReadCardComponent } from './FitnessReadCardComponent';
import { ForecastSettingsComponent } from './ForecastSettingsComponent';
import { sampleDay } from './sample-fitness';
import { bmi, bmiBand, energyFor, targetsFor } from './targets-math';
import { muscleLoad } from './workout-math';

const LOOK_BACK_DAYS = 35;
const CHART_HISTORY_DAYS = 90;
const WEIGH_INS_SHOWN = 8;

const formatDate = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

function AverageRow({ label, average, targets }: { label: string; average: { days: number; average: Targets } | null; targets: Targets | null }) {
  const cell = (value: number | undefined, target: number | undefined, format: (value: number) => string) =>
    value === undefined ? '—' : `${format(value)}${target === undefined ? '' : ` / ${format(target)}`}`;
  return (
    <tr className="border-t">
      <th scope="row" className="py-2 pr-3 text-left font-medium">
        {label}
        <span className="block text-xs font-normal text-muted-foreground">{average ? `${average.days} ${average.days === 1 ? 'day' : 'days'} logged` : 'Nothing logged'}</span>
      </th>
      <td className="py-2 pr-3 tabular-nums">{cell(average?.average.kcal, targets?.kcal, formatKcal)}</td>
      <td className="py-2 pr-3 tabular-nums">{cell(average?.average.proteinMg, targets?.proteinMg, formatGrams)}</td>
      <td className="py-2 pr-3 tabular-nums">{cell(average?.average.carbsMg, targets?.carbsMg, formatGrams)}</td>
      <td className="py-2 tabular-nums">{cell(average?.average.fatMg, targets?.fatMg, formatGrams)}</td>
    </tr>
  );
}

export function FitnessProgressComponent({ fitness, today, hrefFor }: FitnessViewProps) {
  const { profile, weights } = fitness;
  const { saveWeight, deleteWeightWithUndo, saveProfile } = useFitnessMutations();
  const days = useFitnessDays(addDays(today, -(LOOK_BACK_DAYS - 1)), today);
  const [weighDay, setWeighDay] = useState(today);
  const [weighKg, setWeighKg] = useState('');
  const typedKg = parseAmount(weighKg);
  const typedG = typedKg === null ? null : Math.round(typedKg * 1000);
  const weighable = typedG !== null && typedG >= 20_000 && typedG <= 400_000 && weighDay <= today;

  const current = weights.at(-1) ?? null;
  const intake = intakeByDay((days.data ?? sampleDay(today)).logs);
  const targets = targetsFor(profile, current?.weightG ?? null, today);
  const energy = energyFor(profile, current?.weightG ?? null, today);
  const measured = measuredDailyKcal(intake, weights, today, profile.forecast.kcalPerKg);
  const dailyKcal = profile.forecast.energy === 'measured' && measured !== null ? measured : (energy?.daily ?? null);
  const weekAverage = averageIntake(intake, today, 7);
  const trend = trendGPerDay(weights, today, profile.forecast.trendDays);
  const bodyMass = current && profile.heightMm ? bmi(current.weightG, profile.heightMm) : null;

  const projection = (gPerDay: number) =>
    forecast({ startG: (current as { weightG: number }).weightG, goalG: profile.goalWeightG, today, horizonDays: profile.forecast.horizonDays, gPerDay });
  const onPlan = current ? projection(planGPerDay(profile)) : null;
  const onTrend = current && weekAverage && dailyKcal !== null ? projection(trendForecastGPerDay(weekAverage.average.kcal, dailyKcal, profile.forecast.kcalPerKg)) : null;
  const reached = (line: { reachedOn: string | null }) =>
    profile.goalWeightG === null ? 'Set a goal weight in Settings to see a date.' : line.reachedOn ? `Reaches ${formatKg(profile.goalWeightG)} around ${formatDate(line.reachedOn)}.` : 'Not heading towards your goal in this window.';
  const weekWorkouts = (days.data?.workouts ?? []).filter(({ day }) => day > addDays(today, -7));
  const shownWeights = weights.filter(({ day }) => day >= addDays(today, -CHART_HISTORY_DAYS));

  function handleWeighIn(event: FormEvent) {
    event.preventDefault();
    if (!weighable) return;
    saveWeight.mutate({ day: weighDay, weightG: typedG as number });
    setWeighKg('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileComponent label="Current weight" value={current ? formatKg(current.weightG) : '—'} detail={current ? `Weighed ${formatShortDay(current.day)}` : 'Add your first weigh-in'} />
        <StatTileComponent
          label="BMI"
          value={bodyMass === null ? '—' : String(bodyMass)}
          detail={bodyMass === null ? 'Needs your height and a weigh-in' : `${bmiBand(bodyMass)} · BMI cannot tell muscle from fat`}
        />
        <StatTileComponent label="Goal weight" value={profile.goalWeightG ? formatKg(profile.goalWeightG) : '—'} detail={<Link href={hrefFor({ view: 'settings' })} className="underline underline-offset-2 hover:text-foreground">Change in Settings</Link>} />
        <StatTileComponent
          label={`Trend · ${profile.forecast.trendDays} days`}
          value={trend === null ? '—' : `${trend > 0 ? '+' : ''}${((trend * 7) / 1000).toFixed(2)} kg/week`}
          detail={trend === null ? 'Needs two weigh-ins in the window' : 'From your weigh-ins'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCardComponent title="Forecast · estimate" className="lg:col-span-3">
          <div className="flex flex-col gap-3 px-4 pb-4">
            {current && onPlan ? (
              <>
                <ForecastChartComponent
                  weights={shownWeights}
                  trendLine={smoothed(shownWeights)}
                  onPlan={onPlan.points}
                  onTrend={onTrend?.points ?? null}
                  goalG={profile.goalWeightG}
                  label={`Forecast of your weight over the next ${profile.forecast.horizonDays} days`}
                />
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div>
                    <dt className="inline font-medium">On plan: </dt>
                    <dd className="inline text-muted-foreground">{profile.goal === 'maintain' ? 'Your goal is to hold your weight.' : reached(onPlan)}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">On trend: </dt>
                    <dd className="inline text-muted-foreground">
                      {onTrend ? reached(onTrend) : dailyKcal === null ? 'Finish your profile in Settings to see this.' : 'Log what you eat for a few days to see this.'}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground">
                  An estimate from your logs and settings, not a promise. “On trend” uses your average intake over the last 7 days
                  {dailyKcal === null ? '' : ` against a daily energy of ${formatKcal(dailyKcal)}`}.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Add your first weigh-in to see where your weight is heading.</p>
            )}
          </div>
        </SectionCardComponent>

        <SectionCardComponent title="Weigh-ins" className="lg:col-span-2">
          <form onSubmit={handleWeighIn} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2 px-4 pb-3">
            <Input type="date" aria-label="Weigh-in date" max={today} value={weighDay} onChange={(event) => setWeighDay(event.target.value)} />
            <Input aria-label="Weight in kg" placeholder="kg" inputMode="decimal" autoComplete="off" className="tabular-nums" value={weighKg} onChange={(event) => setWeighKg(event.target.value)} />
            <Button type="submit" disabled={!weighable}>
              Add
            </Button>
          </form>
          <ul aria-label="Recent weigh-ins" className="px-2 pb-2">
            {weights
              .slice(-WEIGH_INS_SHOWN)
              .reverse()
              .map((weight) => (
                <li key={weight.day} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm">
                  <span className="text-muted-foreground">{formatDate(weight.day)}</span>
                  <span className="ml-auto font-medium tabular-nums">{formatKg(weight.weightG)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Delete weigh-in of ${formatDate(weight.day)}`} className="size-8 text-muted-foreground" onClick={() => deleteWeightWithUndo(weight)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
          </ul>
        </SectionCardComponent>
      </div>

      <SectionCardComponent title="Average intake against target">
        <Skeleton loading={days.isPending} label="Loading your averages">
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 font-medium" />
                  <th scope="col" className="pb-2 font-medium">Calories</th>
                  <th scope="col" className="pb-2 font-medium">Protein</th>
                  <th scope="col" className="pb-2 font-medium">Carbs</th>
                  <th scope="col" className="pb-2 font-medium">Fat</th>
                </tr>
              </thead>
              <tbody>
                <AverageRow label="Last 7 days" average={weekAverage} targets={targets} />
                <AverageRow label="Last 30 days" average={averageIntake(intake, today, 30)} targets={targets} />
              </tbody>
            </table>
          </div>
        </Skeleton>
        {days.isError && (
          <p role="alert" className="px-4 pb-4 text-sm text-destructive">
            Could not load your food logs. Please try again.
          </p>
        )}
      </SectionCardComponent>

      <FitnessReadCardComponent fitness={fitness} days={days.data} today={today} />

      <SectionCardComponent title="Trained in the last 7 days">
        <Skeleton loading={days.isPending} label="Loading your training">
          <div className="px-4 pb-4">
            <BodyDiagramComponent label="Muscles trained in the last 7 days" strength={strengthFromLoad(muscleLoad(weekWorkouts))} groupLabels={['Most trained', 'Also trained']} />
          </div>
        </Skeleton>
      </SectionCardComponent>

      <ForecastSettingsComponent
        key={JSON.stringify(profile.forecast)}
        settings={profile.forecast}
        canMeasure={measured !== null}
        onSave={(settings) => saveProfile.mutate({ ...profile, forecast: settings })}
      />
    </div>
  );
}
