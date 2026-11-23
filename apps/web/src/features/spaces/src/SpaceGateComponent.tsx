'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { PageSkeletonComponent } from '@/shared/components/PageSkeletonComponent';
import { useActiveSpace } from '../hooks/useActiveSpace';
import { useSpaces } from '../hooks/useSpaces';
import { canLock } from '../hooks/useSpaceLock';
import { SpaceLockGateComponent } from './SpaceLockGateComponent';
import { SpacePresenceProviderComponent } from './SpacePresenceProviderComponent';
import { isOnWrongScreen, spaceHref } from './space-tree';
import { WelcomeComponent } from './WelcomeComponent';

export function SpaceGateComponent({ children }: { children: ReactNode }) {
  const { data: spaces, isPending, isError } = useSpaces();
  const active = useActiveSpace();
  const router = useRouter();
  const pathname = usePathname();
  const correctScreen = active && isOnWrongScreen(active.tool, pathname) ? spaceHref(active) : undefined;

  useEffect(() => {
    if (correctScreen) router.replace(correctScreen);
  }, [correctScreen, router]);

  if (isPending || correctScreen) return <PageSkeletonComponent />;
  if (isError || !spaces) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load your spaces. Please try again.
      </p>
    );
  }
  // Nobody else can be in a Vault, and a folder has nothing open; everywhere else, open the live connection.
  const content =
    active?.kind === 'space' && active.tool !== 'vault' ? (
      <SpacePresenceProviderComponent key={active.id} space={active}>
        {children}
      </SpacePresenceProviderComponent>
    ) : (
      children
    );
  // A locked space only renders (and so only connects) once it is unlocked.
  if (active?.locked && canLock(active)) return <SpaceLockGateComponent space={active}>{content}</SpaceLockGateComponent>;
  if (spaces.some((space) => space.kind === 'space')) return content;

  return <WelcomeComponent />;
}
