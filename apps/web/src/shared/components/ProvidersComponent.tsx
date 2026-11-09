'use client';

import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { SkulletProvider } from 'skullet/react';
import { Toaster } from '@/shared/components/ui/sonner';

const CACHE_FRESH_FOR_MS = 30_000;

// Cache changes must reach the screen before the next paint, or a dropped row flashes its old place.
notifyManager.setScheduler(queueMicrotask);

export function ProvidersComponent({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: CACHE_FRESH_FOR_MS } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SkulletProvider mode="dark">{children}</SkulletProvider>
      <Toaster theme="dark" offset={{ bottom: 80 }} mobileOffset={{ bottom: 72 }} />
    </QueryClientProvider>
  );
}
