import { SkeletonBox } from 'skullet/react';

const ROWS = [0, 1, 2, 3, 4, 5];

export function PageSkeletonComponent() {
  return (
    <div role="status" aria-label="Loading">
      <div className="px-4 pt-5 md:px-6">
        <SkeletonBox width="min(240px, 70%)" height={32} />
        <SkeletonBox className="mt-1.5" width={160} height={16} />
      </div>
      <div className="mt-3 flex gap-3 border-b px-4 pb-2.5 md:px-6">
        <SkeletonBox width={64} height={24} />
        <SkeletonBox width={88} height={24} />
      </div>
      <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
        {ROWS.map((row) => (
          <SkeletonBox key={row} width="100%" height={30} />
        ))}
      </div>
    </div>
  );
}
