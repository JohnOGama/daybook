import type { Weight } from './fitness-types';

const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

type ForecastChartProps = {
  weights: Weight[];
  trendLine: Weight[];
  onPlan: Weight[];
  onTrend: Weight[] | null;
  goalG: number | null;
  label: string;
};

// Past weigh-ins as dots with their smoothed line, then the two projections forward from today.
export function ForecastChartComponent({ weights, trendLine, onPlan, onTrend, goalG, label }: ForecastChartProps) {
  const all = [...weights, ...onPlan, ...(onTrend ?? [])];
  const grams = [...all.map(({ weightG }) => weightG), ...(goalG === null ? [] : [goalG])];
  const lowest = Math.min(...grams) - 500;
  const highest = Math.max(...grams) + 500;
  const first = Math.min(...all.map(({ day }) => dayNumber(day)));
  const last = Math.max(...all.map(({ day }) => dayNumber(day)));
  const x = (day: string) => PAD.left + ((dayNumber(day) - first) / Math.max(last - first, 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (weightG: number) => PAD.top + ((highest - weightG) / (highest - lowest)) * (HEIGHT - PAD.top - PAD.bottom);
  const path = (points: Weight[]) => points.map(({ day, weightG }, index) => `${index === 0 ? 'M' : 'L'}${x(day).toFixed(1)} ${y(weightG).toFixed(1)}`).join(' ');
  const ticks = [highest, (highest + lowest) / 2, lowest];

  return (
    <div className="flex flex-col gap-2">
      <svg role="img" aria-label={label} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {(tick / 1000).toFixed(1)}
            </text>
          </g>
        ))}
        {goalG !== null && <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(goalG)} y2={y(goalG)} className="stroke-muted-foreground" strokeWidth={1} strokeDasharray="2 4" />}
        <line x1={x(onPlan[0].day)} x2={x(onPlan[0].day)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-border" strokeWidth={1} />
        <text x={x(onPlan[0].day)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          Today
        </text>
        {trendLine.length > 1 && <path d={path(trendLine)} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} />}
        {weights.map(({ day, weightG }) => (
          <circle key={day} cx={x(day)} cy={y(weightG)} r={2.5} className="fill-foreground" />
        ))}
        <path d={path(onPlan)} fill="none" className="stroke-signal" strokeWidth={2} />
        {onTrend && <path d={path(onTrend)} fill="none" className="stroke-foreground" strokeWidth={2} strokeDasharray="5 4" />}
      </svg>
      <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-signal" /> On plan
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-foreground" /> On trend
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-foreground" /> Weigh-ins (kg)
        </li>
        {goalG !== null && (
          <li className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dotted border-muted-foreground" /> Goal
          </li>
        )}
      </ul>
    </div>
  );
}
