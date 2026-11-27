'use client';

import { BookOpen, CalendarDays, Dumbbell, House, Settings, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { PresenceAvatarsComponent, useActiveSpace, useSpaceAccess, ViewOnlyBadgeComponent } from '@/features/spaces';
import { useToday } from '@/shared/hooks/useToday';
import { cn } from '@/shared/utils/cn';
import { useFitness } from '../hooks/useFitness';
import { FITNESS_VIEWS, type FitnessView, type FitnessViewProps } from './fitness-types';
import { FitnessCalendarComponent } from './FitnessCalendarComponent';
import { FitnessLibraryComponent } from './FitnessLibraryComponent';
import { FitnessProgressComponent } from './FitnessProgressComponent';
import { FitnessSettingsComponent } from './FitnessSettingsComponent';
import { FitnessSetupComponent } from './FitnessSetupComponent';
import { FitnessTodayComponent } from './FitnessTodayComponent';
import { FitnessWorkoutsComponent } from './FitnessWorkoutsComponent';
import { sampleFitness } from './sample-fitness';
import { hasProfile } from './targets-math';

const TABS: { view: FitnessView; label: string; Icon: typeof House }[] = [
  { view: 'today', label: 'Today', Icon: House },
  { view: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { view: 'workouts', label: 'Workouts', Icon: Dumbbell },
  { view: 'progress', label: 'Progress', Icon: TrendingUp },
  { view: 'library', label: 'Library', Icon: BookOpen },
  { view: 'settings', label: 'Settings', Icon: Settings },
];

const SCREENS: Record<FitnessView, (props: FitnessViewProps) => ReactNode> = {
  today: FitnessTodayComponent,
  calendar: FitnessCalendarComponent,
  workouts: FitnessWorkoutsComponent,
  progress: FitnessProgressComponent,
  library: FitnessLibraryComponent,
  settings: FitnessSettingsComponent,
  // Viewers can't run the onboarding, so a link to it shows them Today.
  setup: FitnessTodayComponent,
};

const isDay = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

export function FitnessPageComponent() {
  const params = useSearchParams();
  const router = useRouter();
  // Skipping lasts for this visit, so the onboarding comes back next time until the profile is set up.
  const [setupLeft, setSetupLeft] = useState(false);
  const space = useActiveSpace();
  const { canEdit } = useSpaceAccess();
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
  // A new space opens straight into the onboarding until its profile is set up or it is skipped; `?view=setup`
  // always opens it.
  const showSetup = canEdit && data !== undefined && (view === 'setup' || (view === 'today' && !setupLeft && !hasProfile(data.profile)));
  function leaveSetup() {
    setSetupLeft(true);
    if (view === 'setup') router.push(hrefFor({ view: 'today' }));
  }

  // The onboarding takes the whole screen, without the title and tabs, centred so no step needs a scroll.
  if (showSetup) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <FitnessSetupComponent fitness={data} today={today} onLeave={leaveSetup} />
      </div>
    );
  }

  // On wide screens Today fits the screen with no page scroll; its columns scroll inside themselves instead.
  const fitsScreen = Screen === FitnessTodayComponent;

  return (
    <div className={cn('pb-16', fitsScreen && 'xl:flex xl:h-full xl:flex-col xl:pb-0')}>
      <header className="shrink-0">
        <div className="flex items-center gap-2 px-4 pt-5 md:px-6">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{space?.title ?? 'Fitness'}</h1>
          <ViewOnlyBadgeComponent />
          <PresenceAvatarsComponent />
        </div>
        <nav aria-label="Fitness views" className="mt-3 flex gap-1.5 overflow-x-auto overflow-y-hidden border-b px-2 md:px-4">
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

      <div className={cn('mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-4 md:px-6', fitsScreen && 'xl:min-h-0 xl:w-full xl:max-w-none xl:flex-1 xl:pb-4')}>
        <Skeleton loading={isPending} label="Loading fitness" className={fitsScreen ? 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col' : undefined}>
          <Screen fitness={data ?? sample} today={today} day={day} hrefFor={hrefFor} canEdit={canEdit} />
        </Skeleton>
      </div>
    </div>
  );
}
