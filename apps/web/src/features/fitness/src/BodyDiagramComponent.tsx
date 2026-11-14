import { cn } from '@/shared/utils/cn';
import { BODY_SHAPES, BODY_VIEW, type BodyShape } from './body-shapes';
import { type Muscle, MUSCLE_LABELS, MUSCLES } from './muscles';

type Strength = Partial<Record<Muscle, number>>;

const PRIMARY = 1;
const SECONDARY = 0.4;
const STRONG_FROM = 0.6;
const BACK_SCALE = BODY_VIEW.frontHeight / BODY_VIEW.backHeight;
const GAP = 100;
const WIDTH = BODY_VIEW.width + GAP + BODY_VIEW.width * BACK_SCALE;

export function strengthFromMuscles({ primary, secondary }: { primary: Muscle[]; secondary: Muscle[] }): Strength {
  return Object.fromEntries([...secondary.map((muscle) => [muscle, SECONDARY]), ...primary.map((muscle) => [muscle, PRIMARY])]);
}

// Each muscle against the most-trained one, so the picture shows balance rather than volume.
export function strengthFromLoad(load: Record<Muscle, number>): Strength {
  const most = Math.max(...Object.values(load));
  return Object.fromEntries(MUSCLES.map((muscle) => [muscle, most > 0 ? Number((load[muscle] / most).toFixed(2)) : 0]));
}

function Region({ shape, strength }: { shape: BodyShape; strength: Strength }) {
  // A region shared by two muscle groups shows the stronger of them.
  const value = Math.max(0, ...shape.muscles.map((muscle) => strength[muscle] ?? 0));
  return (
    <polygon
      points={shape.points}
      data-muscles={shape.muscles.join(' ') || undefined}
      data-strength={shape.muscles.length > 0 ? String(value) : undefined}
      className={cn('stroke-background', value > 0 ? 'fill-signal' : 'fill-muted')}
      fillOpacity={value > 0 ? 0.3 + 0.7 * value : 1}
      strokeWidth={6}
    />
  );
}

function MuscleNames({ label, muscles }: { label: string; muscles: Muscle[] }) {
  if (muscles.length === 0) return null;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {muscles.map((muscle) => (
          <li key={muscle} className="rounded-md border px-1.5 py-0.5 text-xs">
            {MUSCLE_LABELS[muscle]}
          </li>
        ))}
      </ul>
    </div>
  );
}

type BodyDiagramProps = {
  // 0 to 1 per muscle; anything missing counts as 0.
  strength: Strength;
  label: string;
  groupLabels?: [string, string];
  className?: string;
};

// Front and back of a figure with the worked muscles filled in. The names beside it say the same thing in words.
export function BodyDiagramComponent({ strength, label, groupLabels = ['Primary', 'Secondary'], className }: BodyDiagramProps) {
  const worked = MUSCLES.filter((muscle) => (strength[muscle] ?? 0) > 0).sort((a, b) => (strength[b] ?? 0) - (strength[a] ?? 0));
  const strong = worked.filter((muscle) => (strength[muscle] ?? 0) >= STRONG_FROM);
  const light = worked.filter((muscle) => (strength[muscle] ?? 0) < STRONG_FROM);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start', className)}>
      <svg role="img" aria-label={label} viewBox={`0 0 ${WIDTH} ${BODY_VIEW.frontHeight}`} className="h-auto w-full max-w-64 shrink-0">
        <g>
          {BODY_SHAPES.filter((shape) => shape.view === 'front').map((shape) => (
            <Region key={shape.points} shape={shape} strength={strength} />
          ))}
        </g>
        <g transform={`translate(${BODY_VIEW.width + GAP} 0) scale(${BACK_SCALE})`}>
          {BODY_SHAPES.filter((shape) => shape.view === 'back').map((shape) => (
            <Region key={shape.points} shape={shape} strength={strength} />
          ))}
        </g>
      </svg>
      <div className="flex min-w-0 flex-col gap-3">
        <MuscleNames label={groupLabels[0]} muscles={strong} />
        <MuscleNames label={groupLabels[1]} muscles={light} />
        {worked.length === 0 && <p className="text-sm text-muted-foreground">No muscles worked yet.</p>}
      </div>
    </div>
  );
}
