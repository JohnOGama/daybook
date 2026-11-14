'use client';

import { BookOpen, Dumbbell, House, Settings, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useMemo } from 'react';
import { Skeleton } from 'skullet/react';
import { useActiveSpace } from '@/features/spaces';
import { useToday } from '@/shared/hooks/useToday';
import { cn } from '@/shared/utils/cn';
import { useFitness } from '../hooks/useFitness';
import { FITNESS_VIEWS, type FitnessView, type FitnessViewProps } from './fitness-types';
import { FitnessLibraryComponent } from './FitnessLibraryComponent';
import { FitnessProgressComponent } from './FitnessProgressComponent';
import { FitnessSettingsComponent } from './FitnessSettingsComponent';
import { FitnessTodayComponent } from './FitnessTodayComponent';
import { FitnessWorkoutsComponent } from './FitnessWorkoutsComponent';
import { sampleFitness } from './sample-fitness';

const TABS: { view: FitnessView; label: string; Icon: typeof House }[] = [
  { view: 'today', label: 'Today', Icon: House },
  { view: 'workouts', label: 'Workouts', Icon: Dumbbell },
  { view: 'progress', label: 'Progress', Icon: TrendingUp },
  { view: 'library', label: 'Library', Icon: BookOpen },
  { view: 'settings', label: 'Settings', Icon: Settings },
];

const SCREENS: Record<FitnessView, (props: FitnessViewProps) => ReactNode> = {
  today: FitnessTodayComponent,
  workouts: FitnessWorkoutsComponent,
  progress: FitnessProgressComponent,
  library: FitnessLibraryComponent,
  settings: FitnessSettingsComponent,
};

const isDay = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export function FitnessPageComponent() {
  const params = useSearchParams();
  const space = useActiveSpace();
  const today = useToday();
  const { data, isPending, isError } = useFitness();
  const requestedView = params.get('view') as FitnessView;
  const view = FITNESS_VIEWS.includes(requestedView) ? requestedView : 'today';
  const requestedDay = params.get('day');
  const day = isDay(requestedDay) ? requestedDay : today;
  const sample = useMemo(() => sampleFitness(today), [today]);

  const hrefFor = useCallback(
    (change: { view?: FitnessView; day?: string }) => {
      const next = new URLSearchParams({ space: space?.id ?? '' });
      const nextView = change.view ?? view;
      const nextDay = change.day ?? day;
      if (nextView !== 'today') next.set('view', nextView);
      if (nextDay !== today) next.set('day', nextDay);
      return `/fitness?${next}`;
    },
    [space?.id, view, day, today],
  );

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this fitness space. Please try again.
      </p>
    );
  }

  const Screen = SCREENS[view];

  return (
    <div className="pb-16">
      <header>
        <h1 className="truncate px-4 pt-5 text-2xl font-semibold tracking-tight md:px-6">{space?.title ?? 'Fitness'}</h1>
        <nav aria-label="Fitness views" className="mt-3 flex gap-1.5 overflow-x-auto border-b px-2 md:px-4">
          {TABS.map(({ view: tab, label, Icon }) => (
            <Link
              key={tab}
              href={hrefFor({ view: tab })}
              aria-current={view === tab ? 'page' : undefined}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground',
                view === tab && 'border-foreground text-foreground',
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-4 md:px-6">
        <Skeleton loading={isPending} label="Loading fitness">
          <Screen fitness={data ?? sample} today={today} day={day} hrefFor={hrefFor} />
        </Skeleton>
      </div>
    </div>
  );
}
