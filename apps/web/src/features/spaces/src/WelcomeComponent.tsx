'use client';

import { LayoutGrid } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { authClient } from '@/shared/services/auth-client';
import { CreateSpaceFormComponent } from './CreateSpaceFormComponent';
import { TOOL_ICONS } from './SpacesNavComponent';
import type { SpaceTool } from './space-types';

const PEEK: SpaceTool[] = ['list', 'notebook', 'budget', 'fitness', 'jobs', 'uptime'];

// The first page someone sees before they have a space.
export function WelcomeComponent() {
  const { data: session } = authClient.useSession();
  const [browsing, setBrowsing] = useState(false);
  const firstName = session?.user.name?.trim().split(/\s+/)[0];

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 pt-6 pb-20 text-center">
      {firstName && (
        <p className="mb-2.5 text-sm text-muted-foreground">
          Hi {firstName} <span aria-hidden>👋</span>
        </p>
      )}
      <h1 className="text-4xl leading-[1.02] font-black tracking-[-0.035em] md:text-[44px]">Welcome to Daybook</h1>
      <p className="mt-3 mb-7 max-w-md text-[17px] leading-snug tracking-[-0.02em] text-pretty text-muted-foreground">
        Your personal workspace for the things you keep track of. Everything lives in spaces, and each space runs one tool: a task list, a notebook, a budget and more.
      </p>
      <div className="mb-7 flex gap-2" aria-hidden>
        {PEEK.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          return (
            <span key={tool} className="grid size-11 place-items-center rounded-xl bg-card dark:border">
              <Icon className="size-5" />
            </span>
          );
        })}
      </div>
      <Button size="lg" onClick={() => setBrowsing(true)}>
        <LayoutGrid aria-hidden />
        Browse tools
      </Button>
      <p className="mt-3.5 text-xs text-muted-foreground">Pick one to start. You can add more spaces any time.</p>

      <Dialog open={browsing} onOpenChange={setBrowsing}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Browse tools</DialogTitle>
            <DialogDescription>Each space runs one tool. Pick the one you want to start with.</DialogDescription>
          </DialogHeader>
          <CreateSpaceFormComponent onCancel={() => setBrowsing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
