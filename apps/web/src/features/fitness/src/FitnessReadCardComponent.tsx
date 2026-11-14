'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { SkeletonBox } from 'skullet/react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { useFitnessSpaceId } from '../hooks/useFitness';
import { fetchFitnessRead, type FitnessRead } from './fitness-api';
import { fitnessSummary } from './fitness-summary';
import type { Day, Fitness } from './fitness-types';

type FitnessReadCardProps = { fitness: Fitness; days: Day | undefined; today: string };

// An AI read of where the owner stands, on request. It is sent fitnessSummary's figures and nothing else.
export function FitnessReadCardComponent({ fitness, days, today }: FitnessReadCardProps) {
  const spaceId = useFitnessSpaceId() ?? '';
  const [read, setRead] = useState<FitnessRead>();
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string>();

  async function write() {
    if (!days) return;
    setWriting(true);
    setError(undefined);
    try {
      setRead(await fetchFitnessRead({ spaceId, summary: fitnessSummary({ profile: fitness.profile, weights: fitness.weights, days, today }) }));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setWriting(false);
    }
  }

  return (
    <SectionCardComponent
      title="Where do I stand?"
      action={
        fitness.aiEnabled && (
          <Button variant="outline" size="sm" onClick={write} disabled={writing || !days}>
            <Sparkles aria-hidden />
            {read ? 'Ask again' : 'Ask the AI'}
          </Button>
        )
      }
    >
      <div className="px-4 pb-4 text-sm" aria-live="polite">
        {!fitness.aiEnabled && <p className="text-muted-foreground">Add a Gemini API key to the server (GEMINI_API_KEY) to get a written read of your progress.</p>}
        {fitness.aiEnabled && !read && !error && !writing && (
          <p className="text-muted-foreground">
            Gemini reads your summary figures (weight trend, average intake against target, sets per muscle group, forecast) and writes a short read. Food names, workout names and
            notes are not sent.
          </p>
        )}
        {writing && (
          <div role="status" aria-label="Writing your read" className="flex flex-col gap-2.5">
            <SkeletonBox width="60%" height={16} />
            <SkeletonBox width="92%" height={14} />
            <SkeletonBox width="80%" height={14} />
          </div>
        )}
        {error && !writing && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {read && !writing && (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{read.headline}</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
              {read.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">AI estimate from your summary figures. Not medical advice.</p>
          </div>
        )}
      </div>
    </SectionCardComponent>
  );
}
