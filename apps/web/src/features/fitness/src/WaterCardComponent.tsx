'use client';

import { GlassWater, Minus, Plus } from 'lucide-react';
import { SectionCardComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { MAX_GLASSES, WATER_GOAL } from './fitness-types';

type WaterCardProps = { day: string; glasses: number; canEdit: boolean };

// Glasses of water on the shown day: tap a glass to fill up to it, or step one at a time.
export function WaterCardComponent({ day, glasses, canEdit }: WaterCardProps) {
  const { saveWater } = useFitnessMutations();
  const set = (next: number) => saveWater.mutate({ day, glasses: Math.min(Math.max(next, 0), MAX_GLASSES) });
  const extra = glasses - WATER_GOAL;

  return (
    <SectionCardComponent
      title="Water"
      action={
        <span className="text-xs text-muted-foreground tabular-nums">
          {glasses} of {WATER_GOAL} glasses
        </span>
      }
    >
      <div className="flex items-center gap-2 px-4 pb-4">
        {canEdit && (
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="One glass less" disabled={glasses === 0} onClick={() => set(glasses - 1)}>
            <Minus aria-hidden />
          </Button>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
          {Array.from({ length: WATER_GOAL }, (_, index) => {
            const full = index < glasses;
            const glass = <GlassWater className={cn('size-5', full ? 'text-foreground' : 'text-muted-foreground/40')} aria-hidden />;
            return canEdit ? (
              <button
                key={index}
                type="button"
                aria-label={`${index + 1} ${index === 0 ? 'glass' : 'glasses'}`}
                aria-pressed={full}
                // Tapping the last full glass empties it, so a mis-tap is one more tap to undo.
                onClick={() => set(index + 1 === glasses ? index : index + 1)}
                className="grid size-7 place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                {glass}
              </button>
            ) : (
              <span key={index} className="grid size-7 place-items-center">
                {glass}
              </span>
            );
          })}
          {extra > 0 && <span className="ml-1 text-xs font-medium text-muted-foreground tabular-nums">+{extra}</span>}
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="One more glass" disabled={glasses >= MAX_GLASSES} onClick={() => set(glasses + 1)}>
            <Plus aria-hidden />
          </Button>
        )}
      </div>
    </SectionCardComponent>
  );
}
