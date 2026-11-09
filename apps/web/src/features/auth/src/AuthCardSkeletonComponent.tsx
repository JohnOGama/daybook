import { SkeletonBox } from 'skullet/react';

export function AuthCardSkeletonComponent() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar p-4">
      <div role="status" aria-label="Loading" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6">
        <SkeletonBox width={112} height={28} />
        <SkeletonBox width="60%" height={28} />
        <SkeletonBox width="100%" height={36} />
        <SkeletonBox width="100%" height={36} />
        <SkeletonBox width="100%" height={36} />
      </div>
    </main>
  );
}
