import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { addDays, formatShortDay } from '@/shared/utils/date-formatter';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { formatKg, parseAmount } from './fitness-format';
import type { FitnessViewProps } from './fitness-types';
import { trendGPerDay } from './forecast-math';

const HISTORY_DAYS = 60;
const WIDTH = 300;
const HEIGHT = 80;

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

// Current weight, how it is moving and how far from the goal, with a weigh-in for the shown day.
export function WeightCardComponent({ fitness, today, day, hrefFor }: FitnessViewProps) {
  const { profile, weights } = fitness;
  const { saveWeight } = useFitnessMutations();
  const [typed, setTyped] = useState('');
  const typedKg = parseAmount(typed);
  const typedG = typedKg === null ? null : Math.round(typedKg * 1000);
  const weighable = typedG !== null && typedG >= 20_000 && typedG <= 400_000 && day <= today;

  const shown = weights.filter((weight) => weight.day <= day && weight.day > addDays(day, -HISTORY_DAYS));
  const current = shown.at(-1) ?? null;
  const trend = trendGPerDay(weights, day, profile.forecast.trendDays);
  const toGoal = current && profile.goalWeightG !== null ? current.weightG - profile.goalWeightG : null;

  const grams = [...shown.map(({ weightG }) => weightG), ...(profile.goalWeightG === null ? [] : [profile.goalWeightG])];
  const lowest = Math.min(...grams) - 300;
  const highest = Math.max(...grams) + 300;
  const first = dayNumber(shown[0]?.day ?? day);
  const span = Math.max(dayNumber(current?.day ?? day) - first, 1);
  const x = (weightDay: string) => ((dayNumber(weightDay) - first) / span) * WIDTH;
  const y = (weightG: number) => ((highest - weightG) / (highest - lowest)) * HEIGHT;
  const line = shown.map(({ day: weightDay, weightG }, index) => `${index === 0 ? 'M' : 'L'}${x(weightDay).toFixed(1)} ${y(weightG).toFixed(1)}`).join(' ');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!weighable) return;
    saveWeight.mutate({ day, weightG: typedG as number });
    setTyped('');
  }

  return (
    <SectionCardComponent
      title="Weight"
      action={
        <Link href={hrefFor({ view: 'progress' })} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Forecast
        </Link>
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{current ? formatKg(current.weightG) : '—'}</span>
            <span className="text-xs text-muted-foreground">{current ? `Weighed ${formatShortDay(current.day)}` : 'No weigh-ins yet'}</span>
          </div>
          <dl className="flex flex-col items-end text-xs tabular-nums">
            {trend !== null && (
              <div>
                <dt className="sr-only">Trend</dt>
                <dd>
                  {trend > 0 ? '+' : ''}
                  {((trend * 7) / 1000).toFixed(2)} kg/week
                </dd>
              </div>
            )}
            {toGoal !== null && (
              <div>
                <dt className="sr-only">Goal</dt>
                <dd className="text-muted-foreground">{Math.abs(toGoal) < 100 ? 'At your goal' : `${formatKg(Math.abs(toGoal))} ${toGoal > 0 ? 'above' : 'below'} goal`}</dd>
              </div>
            )}
          </dl>
        </div>

        {shown.length > 1 ? (
          <div>
            <svg role="img" aria-label={`Weight over the last ${HISTORY_DAYS} days`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-20 w-full overflow-visible">
              {profile.goalWeightG !== null && (
                <line x1={0} x2={WIDTH} y1={y(profile.goalWeightG)} y2={y(profile.goalWeightG)} className="stroke-muted-foreground" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              )}
              <path d={`${line} L${WIDTH} ${HEIGHT} L0 ${HEIGHT} Z`} className="fill-signal" fillOpacity={0.12} />
              <path d={line} fill="none" className="stroke-signal" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div aria-hidden className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{formatShortDay(shown[0].day)}</span>
              {profile.goalWeightG !== null && <span>Goal {formatKg(profile.goalWeightG)}</span>}
              <span>{formatShortDay(shown[shown.length - 1].day)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Weigh in on two days to see your trend.</p>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            aria-label="Weight in kg"
            placeholder={current ? (current.weightG / 1000).toFixed(1) : 'kg'}
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!weighable}>
            Log weight
          </Button>
        </form>
      </div>
    </SectionCardComponent>
  );
}
