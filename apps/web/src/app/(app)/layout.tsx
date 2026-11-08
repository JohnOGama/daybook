import { type ReactNode, Suspense } from 'react';
import { AppShellComponent } from '@/features/shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AppShellComponent>{children}</AppShellComponent>
    </Suspense>
  );
}
