'use client';

import { Settings } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Switch } from '@/shared/components/ui/switch';
import { useSetCarryOver } from '../hooks/useSetCarryOver';
import type { Space } from './space-types';

export function SpaceSettingsComponent({ space }: { space: Space }) {
  const setCarryOver = useSetCarryOver();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="self-center text-muted-foreground">
          <Settings aria-hidden />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carry-over">Carry over unfinished tasks</Label>
            <p id="carry-over-description" className="text-xs text-muted-foreground">
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
      </PopoverContent>
    </Popover>
  );
}
