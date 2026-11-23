'use client';

import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
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
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {/* No mode: the skeleton colours are --skullet-base and --skullet-highlight in globals.css, per theme. */}
        <SkulletProvider>{children}</SkulletProvider>
        <Toaster offset={{ bottom: 80 }} mobileOffset={{ bottom: 72 }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
