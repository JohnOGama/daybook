'use client';

import { Check, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { useSignOut } from '../hooks/useSignOut';

// Stands in for the sidebar until the first space exists.
export function FirstRunBarComponent() {
  const handleSignOut = useSignOut();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-5">
      <span className="flex items-center gap-2.5 font-display font-extrabold tracking-[-0.03em]">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        Daybook
      </span>
      <nav aria-label="Account" className="flex gap-1">
        <Button variant="ghost" asChild>
          <Link href="/preferences">
            <Settings aria-hidden />
            Settings
          </Link>
        </Button>
        <Button variant="ghost" onClick={handleSignOut}>
          <LogOut aria-hidden />
          Sign out
        </Button>
      </nav>
    </header>
  );
}
