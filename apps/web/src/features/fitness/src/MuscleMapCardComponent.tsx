import { useState } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { BodyDiagramComponent, strengthFromLoad } from './BodyDiagramComponent';
import type { Workout } from './fitness-types';
import { muscleLoad } from './workout-math';

const RANGES = [
  { value: 'day', label: 'This day', describe: 'on this day' },
  { value: 'week', label: '7 days', describe: 'in the last 7 days' },
] as const;

type MuscleMapCardProps = { workouts: Workout[]; day: string };

// Muscles from ticked sets, for the shown day or the week up to it.
export function MuscleMapCardComponent({ workouts, day }: MuscleMapCardProps) {
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('day');
  const shown = range === 'day' ? workouts.filter((workout) => workout.day === day) : workouts;
  const { describe } = RANGES.find(({ value }) => value === range) as (typeof RANGES)[number];

  return (
    <SectionCardComponent
      title="Muscle map"
      action={
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Muscle map range"
          value={range}
          onValueChange={(next) => next && setRange(next as typeof range)}
        >
          {RANGES.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className="px-2.5 text-xs">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <div className="px-4 pb-4">
        <BodyDiagramComponent
          label={`Muscles worked ${describe}`}
          strength={strengthFromLoad(muscleLoad(shown))}
          groupLabels={['Most worked', 'Also worked']}
          className="items-center sm:flex-col sm:items-center"
        />
      </div>
    </SectionCardComponent>
  );
}
