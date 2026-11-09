import { SkeletonBox } from 'skullet/react';
import { PageSkeletonComponent } from './PageSkeletonComponent';

export function AppSkeletonComponent() {
  return (
    <div className="flex min-h-dvh bg-sidebar">
      <aside aria-hidden className="hidden w-56 shrink-0 flex-col gap-3 p-3 md:flex">
        <SkeletonBox width="100%" height={54} radius={16} />
        <SkeletonBox className="mt-5" width={72} height={16} />
        <SkeletonBox width="100%" height={28} />
        <SkeletonBox width="100%" height={28} />
        <SkeletonBox width="100%" height={28} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:py-2">
        <div className="p-2 md:hidden">
          <SkeletonBox width={120} height={36} />
        </div>
        <main className="flex-1 bg-background md:rounded-l-2xl md:border-l">
          <PageSkeletonComponent />
        </main>
      </div>
    </div>
  );
}
