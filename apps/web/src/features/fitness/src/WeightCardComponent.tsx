import { type FormEvent, useState } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { addDays } from '@/shared/utils/date-formatter';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { formatKg, parseAmount } from './fitness-format';
import type { FitnessViewProps } from './fitness-types';

const WINDOW_DAYS = 30;
const WIDTH = 300;
const HEIGHT = 96;
// Room above and below so the dots on the top and bottom ticks are not clipped.
const PAD = 6;
// The kg scale snaps to half kilos, so the labels read 77.5, 78.0, 78.5 rather than odd decimals.
const STEP_G = 500;

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
const signedKg = (grams: number) => `${grams > 0 ? '+' : grams < 0 ? '−' : ''}${(Math.abs(grams) / 1000).toFixed(1)}`;

// A rounded line: each segment bends through its horizontal midpoint, so it is smooth but never swings above or below
// a real weigh-in (unlike a spline, which overshoots).
function smoothPath(points: (readonly [number, number])[]): string {
  return points
    .map(([x, y], index) => {
      if (index === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
      const [px, py] = points[index - 1];
      const mid = ((px + x) / 2).toFixed(1);
      return `C${mid} ${py.toFixed(1)} ${mid} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

// Half-kilo bounds around the weigh-ins, at least 1 kg apart and an even number of steps, so the middle label is round too.
function scaleFor(grams: number[]): { low: number; high: number } {
  const low = Math.floor(Math.min(...grams) / STEP_G) * STEP_G;
  let high = Math.max(Math.ceil(Math.max(...grams) / STEP_G) * STEP_G, low + 2 * STEP_G);
  if (((high - low) / STEP_G) % 2 === 1) high += STEP_G;
  return { low, high };
}

// The latest weight, how it moved over the last 30 days, and a rounded line through those weigh-ins with kg labels.
// One weigh-in per day: logging today and again next week adds two points; logging twice on a day replaces it.
export function WeightCardComponent({ fitness, today, day, canEdit = true }: FitnessViewProps) {
  const { weights } = fitness;
  const { saveWeight } = useFitnessMutations();
  const [typed, setTyped] = useState('');
  const typedKg = parseAmount(typed);
  const typedG = typedKg === null ? null : Math.round(typedKg * 1000);
  const weighable = typedG !== null && typedG >= 20_000 && typedG <= 400_000 && day <= today;

  const current = weights.filter((weight) => weight.day <= day).at(-1) ?? null;
  const onThisDay = current?.day === day ? current : null;
  const shown = weights.filter((weight) => weight.day <= day && weight.day > addDays(day, -WINDOW_DAYS));
  const change = shown.length > 1 ? shown[shown.length - 1].weightG - shown[0].weightG : null;

  const { low, high } = scaleFor(shown.length > 0 ? shown.map(({ weightG }) => weightG) : [0]);
  const ticks = [high, (low + high) / 2, low];
  const first = dayNumber(addDays(day, -WINDOW_DAYS + 1));
  const x = (weightDay: string) => ((dayNumber(weightDay) - first) / (WINDOW_DAYS - 1)) * WIDTH;
  const y = (weightG: number) => PAD + (1 - (weightG - low) / (high - low)) * (HEIGHT - 2 * PAD);
  const points = shown.map(({ day: weightDay, weightG }) => [x(weightDay), y(weightG)] as const);
  // A single weigh-in draws as a level line, so there is always a line to read.
  const line = points.length === 1 ? `M0 ${points[0][1]} L${WIDTH} ${points[0][1]}` : smoothPath(points);

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
        <span className="flex items-center gap-1.5 text-sm tabular-nums">
          <span className="font-semibold">{current ? formatKg(current.weightG) : '—'}</span>
          {change !== null && <span className="text-muted-foreground">{signedKg(change)} in {WINDOW_DAYS} days</span>}
        </span>
      }
    >
      <div className="flex flex-col gap-3 px-4 pb-4">
        {points.length > 0 ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            {/* The kg labels, each centred on its guide line. */}
            <div aria-hidden className="relative h-24 w-8 text-right text-[10px] text-muted-foreground tabular-nums">
              {ticks.map((tick) => (
                <span key={tick} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(y(tick) / HEIGHT) * 100}%` }}>
                  {(tick / 1000).toFixed(1)}
                </span>
              ))}
            </div>
            <div className="relative h-24">
              <svg role="img" aria-label={`Weight over the last ${WINDOW_DAYS} days`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="size-full overflow-visible">
                {ticks.map((tick) => (
                  <line key={tick} x1={0} x2={WIDTH} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                ))}
                <path d={line} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* HTML dots, because the stretched SVG would squash circles into ovals. The latest weigh-in is the yellow one. */}
              {points.map(([px, py], index) => {
                const latest = index === points.length - 1;
                return (
                  <span
                    key={shown[index].day}
                    aria-hidden
                    className={latest ? 'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal' : 'absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground'}
                    style={{ left: `${(px / WIDTH) * 100}%`, top: `${(py / HEIGHT) * 100}%` }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{current ? `No weigh-ins in the last ${WINDOW_DAYS} days.` : 'No weigh-ins yet. Log your first one below.'}</p>
        )}

        {canEdit && day <= today && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Input
                aria-label="Weight in kg"
                placeholder={current ? `${(current.weightG / 1000).toFixed(1)} kg` : 'Weight in kg'}
                inputMode="decimal"
                autoComplete="off"
                className="tabular-nums"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
              <Button type="submit" variant="outline" disabled={!weighable}>
                Log weight
              </Button>
            </div>
            {onThisDay && <p className="text-xs text-muted-foreground tabular-nums">Logging again replaces this day’s {formatKg(onThisDay.weightG)}.</p>}
          </form>
        )}
      </div>
    </SectionCardComponent>
  );
}
