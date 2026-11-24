'use client';

import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { PresenceAvatarsComponent, useActiveSpace, useSpaceAccess, useSpaces, ViewOnlyBadgeComponent } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { useToday } from '@/shared/hooks/useToday';
import { useFocus, useSaveFocusSettings } from '../hooks/useFocus';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { idleTimer, isActive } from './focus-math';
import { FocusClockComponent } from './FocusClockComponent';
import { FocusSettingsDialogComponent } from './FocusSettingsDialogComponent';
import { FocusStatsComponent } from './FocusStatsComponent';
import { sampleFocus } from './sample-focus';

export function FocusPageComponent() {
  const space = useActiveSpace();
  const { canEdit } = useSpaceAccess();
  const today = useToday();
  const { data, isPending, isError } = useFocus(today);
  const { data: spaces = [] } = useSpaces();
  const saveSettings = useSaveFocusSettings();
  const focus = useFocusTimer();
  const [editing, setEditing] = useState(false);
  const sample = useMemo(() => sampleFocus(today), [today]);
  const view = data ?? sample;
  const spaceId = space?.id;

  const { prepare } = focus;
  useEffect(() => {
    if (data && spaceId && canEdit) prepare(spaceId, data.settings);
  }, [data, spaceId, canEdit, prepare]);

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this focus space. Please try again.
      </p>
    );
  }

  const timer = focus.timer?.spaceId === spaceId ? focus.timer : null;
  const elsewhere = focus.timer && focus.timer.spaceId !== spaceId && isActive(focus.timer) ? focus.timer : null;
  const shown = timer ?? idleTimer(spaceId ?? '', view.settings, () => 'preview');
  const elsewhereTitle = spaces.find((other) => other.id === elsewhere?.spaceId)?.title ?? 'another Focus space';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight">{space?.title ?? 'Focus'}</h1>
        <ViewOnlyBadgeComponent />
        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatarsComponent />
          {canEdit && (
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => setEditing(true)}>
              <Settings2 aria-hidden />
              Timer lengths
            </Button>
          )}
        </div>
      </header>

      {elsewhere && (
        <p role="status" className="rounded-xl border bg-card px-4 py-3 text-sm">
          A timer is running in{' '}
          <Link href={`/focus?space=${elsewhere.spaceId}`} className="font-medium underline underline-offset-2">
            {elsewhereTitle}
          </Link>
          . Finish or reset it there to start one here.
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {canEdit ? (
            <Skeleton loading={isPending} label="Loading the timer">
              <fieldset disabled={Boolean(elsewhere)} className="contents">
                <FocusClockComponent timer={shown} now={focus.now} controls={focus} />
              </fieldset>
            </Skeleton>
          ) : (
            <p className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">You can view this space. The timer is for people who can edit it.</p>
          )}
        </div>
        <Skeleton loading={isPending} label="Loading your sessions">
          <FocusStatsComponent sessions={view.sessions} today={today} />
        </Skeleton>
      </div>

      {editing && <FocusSettingsDialogComponent settings={view.settings} onSave={(settings) => saveSettings.mutate(settings)} onClose={() => setEditing(false)} />}
    </div>
  );
}
