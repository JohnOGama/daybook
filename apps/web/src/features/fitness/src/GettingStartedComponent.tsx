'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useFoodSearch } from '../hooks/useFoodSearch';
import type { Fitness, FitnessView } from './fitness-types';

type Step = { title: string; detail: string; done: boolean; action: ReactNode };

type GettingStartedProps = {
  fitness: Fitness;
  // Food logged in the days on screen; when there is none, recently logged foods tell whether anything was ever logged.
  hasFoodThisWeek: boolean;
  hrefFor: (change: { view: FitnessView }) => string;
  onLogFood: () => void;
};

// The three steps that make Today useful, shown until all are done.
export function GettingStartedComponent({ fitness, hasFoodThisWeek, hrefFor, onLogFood }: GettingStartedProps) {
  const { profile, weights } = fitness;
  const recent = useFoodSearch('');
  const hasProfile = Boolean(profile.sex && profile.birthDate && profile.heightMm) || profile.macros.method === 'manual';
  const hasFood = hasFoodThisWeek || (recent.data?.length ?? 0) > 0;
  if (!hasFoodThisWeek && recent.isPending) return null;

  const steps: Step[] = [
    {
      title: 'Tell us about you',
      detail: 'Your height, age and goal set your daily calories and macros.',
      done: hasProfile,
      action: <Link href={hrefFor({ view: 'settings' })}>Open settings</Link>,
    },
    {
      title: 'Add your weight',
      detail: 'Weigh in now and then to track progress towards your goal.',
      done: weights.length > 0,
      action: <Link href={hrefFor({ view: 'progress' })}>Add a weigh-in</Link>,
    },
    {
      title: 'Log something you ate',
      detail: 'Search the food list and say how much. Next time it is one tap.',
      done: hasFood,
      action: 'Log food',
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <SectionCardComponent
      title="Get started"
      action={
        <span className="text-xs text-muted-foreground tabular-nums">
          {doneCount} of {steps.length} done
        </span>
      }
    >
      <ol className="flex flex-col gap-1 px-2 pb-2">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums',
                step.done && 'border-foreground bg-foreground text-background',
              )}
            >
              {step.done ? <Check className="size-4" aria-label="Done" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn('text-sm font-medium', step.done && 'text-muted-foreground line-through')}>{step.title}</span>
              {!step.done && <span className="text-xs text-muted-foreground">{step.detail}</span>}
            </span>
            {!step.done &&
              (typeof step.action === 'string' ? (
                <Button size="sm" variant="outline" className="shrink-0" onClick={onLogFood}>
                  {step.action}
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  {step.action}
                </Button>
              ))}
          </li>
        ))}
      </ol>
    </SectionCardComponent>
  );
}
