'use client';

import { Menu } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AssistantPanelComponent } from '@/features/assistant';
import { SpaceGateComponent } from '@/features/spaces';
import { TaskMutationsProviderComponent } from '@/features/tasks';
import { VaultSessionProviderComponent } from '@/features/vault';
import { AppSkeletonComponent } from '@/shared/components/AppSkeletonComponent';
import { Button } from '@/shared/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet';
import { authClient } from '@/shared/services/auth-client';
import { LiveUpdatesProviderComponent } from './LiveUpdatesProviderComponent';
import { ResizableSidebarComponent } from './ResizableSidebarComponent';
import { SidebarComponent } from './SidebarComponent';

export function AppShellComponent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSpaceParam = useSearchParams().get('space');
  const pathname = usePathname();

  useEffect(() => {
    if (!isPending && !session) router.replace('/sign-in');
  }, [isPending, session, router]);

  useEffect(() => setMenuOpen(false), [activeSpaceParam, pathname]);

  if (!session) return <AppSkeletonComponent />;
  const outsideSpaces = pathname === '/trash' || pathname === '/preferences';

  return (
    <LiveUpdatesProviderComponent>
    <div className="flex h-dvh overflow-hidden bg-sidebar">
      <ResizableSidebarComponent>
        <SidebarComponent />
      </ResizableSidebarComponent>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:py-2">
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
          <span className="font-semibold">Daybook</span>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto bg-background md:rounded-l-2xl md:border-l">
          <TaskMutationsProviderComponent>
            <VaultSessionProviderComponent>
              {outsideSpaces ? children : <SpaceGateComponent>{children}</SpaceGateComponent>}
            </VaultSessionProviderComponent>
          </TaskMutationsProviderComponent>
        </main>
      </div>
      <AssistantPanelComponent />
    </div>
    </LiveUpdatesProviderComponent>
  );
}
