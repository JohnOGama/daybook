import type { Metadata } from 'next';
import { Geist, Nunito } from 'next/font/google';
import type { ReactNode } from 'react';
import { ProvidersComponent } from '@/shared/components/ProvidersComponent';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const nunito = Nunito({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: 'Daybook',
  description: 'Personal planner',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the `dark` class before paint, so the server's markup differs on purpose.
    <html lang="en" className={`${geist.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body>
        <ProvidersComponent>{children}</ProvidersComponent>
      </body>
    </html>
  );
}
