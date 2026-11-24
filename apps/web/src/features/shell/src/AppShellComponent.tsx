'use client';

import { Menu } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AssistantPanelComponent } from '@/features/assistant';
import { SpaceGateComponent, useSpaces } from '@/features/spaces';
import { TaskMutationsProviderComponent } from '@/features/tasks';
import { VaultSessionProviderComponent } from '@/features/vault';
import { AppSkeletonComponent } from '@/shared/components/AppSkeletonComponent';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet';
import { authClient } from '@/shared/services/auth-client';
import { cn } from '@/shared/utils/cn';
import { FirstRunBarComponent } from './FirstRunBarComponent';
import { LiveUpdatesProviderComponent } from './LiveUpdatesProviderComponent';
import { FocusPillComponent, FocusTimerProviderComponent } from '@/features/focus';
import { ResizableSidebarComponent } from './ResizableSidebarComponent';
import { SidebarComponent } from './SidebarComponent';

export function AppShellComponent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  if (!session) return <AppSkeletonComponent />;
  return <SignedInShell>{children}</SignedInShell>;
}

function SignedInShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSpaceParam = useSearchParams().get('space');
  const pathname = usePathname();
  const { data: spaces } = useSpaces();

  useEffect(() => setMenuOpen(false), [activeSpaceParam, pathname]);

  const outsideSpaces = pathname === '/trash' || pathname === '/preferences' || pathname === '/assistant';
  // Someone with no space yet gets the welcome page on its own, without the sidebar.
  const firstRun = !outsideSpaces && spaces !== undefined && !spaces.some((space) => space.kind === 'space');

  return (
    <LiveUpdatesProviderComponent>
    <FocusTimerProviderComponent>
    <div className="flex h-dvh overflow-hidden bg-sidebar">
      {!firstRun && (
        <ResizableSidebarComponent>
          <SidebarComponent />
        </ResizableSidebarComponent>
      )}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !firstRun && 'md:py-2 md:pr-2')}>
        {firstRun ? (
          <FirstRunBarComponent />
        ) : (
          <div className="flex items-center gap-2 p-2 md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 overflow-y-auto bg-sidebar p-3">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SidebarComponent />
              </SheetContent>
            </Sheet>
            <span className="font-display font-extrabold tracking-[-0.03em]">Daybook</span>
          </div>
        )}
        <main className={cn('min-h-0 flex-1 overflow-y-auto', !firstRun && 'bg-background md:rounded-[28px] md:border md:border-black/10 md:dark:border-border')}>
          <TaskMutationsProviderComponent>
            <VaultSessionProviderComponent>
              {outsideSpaces ? children : <SpaceGateComponent>{children}</SpaceGateComponent>}
            </VaultSessionProviderComponent>
          </TaskMutationsProviderComponent>
        </main>
      </div>
      <AssistantPanelComponent />
      <FocusPillComponent />
    </div>
    </FocusTimerProviderComponent>
    </LiveUpdatesProviderComponent>
  );
}
