import { type ReactNode, Suspense } from 'react';
import { AppShellComponent } from '@/features/shell';
import { AppSkeletonComponent } from '@/shared/components/AppSkeletonComponent';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppSkeletonComponent />}>
      <AppShellComponent>{children}</AppShellComponent>
    </Suspense>
  );
}
