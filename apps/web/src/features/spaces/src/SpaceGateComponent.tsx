'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { FirstSpaceIcon } from '@/shared/components/EmptyStateIconsComponent';
import { PageSkeletonComponent } from '@/shared/components/PageSkeletonComponent';
import { useActiveSpace } from '../hooks/useActiveSpace';
import { useSpaces } from '../hooks/useSpaces';
import { CreateSpaceFormComponent } from './CreateSpaceFormComponent';
import { spaceHref } from './space-tree';

export function SpaceGateComponent({ children }: { children: ReactNode }) {
  const { data: spaces, isPending, isError } = useSpaces();
  const active = useActiveSpace();
  const router = useRouter();
  const onNotebookScreen = usePathname() === '/notebook';
  const correctScreen = active && (active.tool === 'notebook') !== onNotebookScreen ? spaceHref(active) : undefined;

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
  if (spaces.some((space) => space.kind === 'space')) return children;

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center p-8 text-center">
      <FirstSpaceIcon />
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Create your first space</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground">A space holds your tasks or your pages. Name it and pick a tool.</p>
      <div className="w-full max-w-sm">
        <CreateSpaceFormComponent />
      </div>
    </div>
  );
}
