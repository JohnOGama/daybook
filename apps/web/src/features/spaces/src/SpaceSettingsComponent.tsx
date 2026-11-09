'use client';

import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { useSetCarryOver } from '../hooks/useSetCarryOver';
import type { Space } from './space-types';

export function SpaceSettingsComponent({ space }: { space: Space }) {
  const setCarryOver = useSetCarryOver();

  return (
    <div className="mx-auto flex max-w-xl items-center justify-between gap-6 rounded-lg border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="carry-over">Carry over unfinished tasks</Label>
        <p id="carry-over-description" className="text-sm text-muted-foreground">
          Unfinished tasks from past days move to today. Finished tasks stay on the day they were finished.
        </p>
      </div>
      <Switch
        id="carry-over"
        aria-describedby="carry-over-description"
        checked={space.carryOver}
        onCheckedChange={(carryOver) => setCarryOver.mutate({ id: space.id, carryOver })}
      />
    </div>
  );
}
