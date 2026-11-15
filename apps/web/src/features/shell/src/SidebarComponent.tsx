'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, LogOut, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SpacesNavComponent } from '@/features/spaces';
import { SpaceSummaryComponent } from '@/features/tasks';
import { BinIcon } from '@/shared/components/BrandIconsComponent';
import { authClient } from '@/shared/services/auth-client';
import { cn } from '@/shared/utils/cn';

export function SidebarComponent() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isTrash = pathname === '/trash';
  const isSettings = pathname === '/preferences';
  const isAssistant = pathname === '/assistant';

  async function handleSignOut() {
    await authClient.signOut();
    queryClient.clear();
    router.push('/sign-in');
  }

  return (
    <nav aria-label="Main" className="flex min-h-full w-full flex-col">
      <div className="flex items-center gap-2.5 rounded-2xl border bg-card p-3 font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        Daybook
      </div>

      <SpacesNavComponent renderSpaceSummary={(space) => <SpaceSummaryComponent spaceId={space.id} />} />

      <div className="mt-auto pt-8">
        <Link
          href="/assistant"
          aria-current={isAssistant ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent',
            isAssistant && 'bg-muted font-medium text-foreground',
          )}
        >
          <Sparkles className="size-[18px]" aria-hidden />
          Assistant
        </Link>
        <Link
          href="/preferences"
          aria-current={isSettings ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent',
            isSettings && 'bg-muted font-medium text-foreground',
          )}
        >
          <Settings className="size-[18px]" aria-hidden />
          Settings
        </Link>
        <Link
          href="/trash"
          aria-current={isTrash ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent',
            isTrash && 'bg-muted font-medium text-foreground',
          )}
        >
          <BinIcon className="size-[18px]" data-active={isTrash || undefined} aria-hidden />
          Trash
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <LogOut className="size-[18px]" aria-hidden />
          Sign out
        </button>
      </div>
    </nav>
  );
}
