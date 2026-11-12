'use client';

import { ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { SpacePasswordsComponent } from '@/features/spaces';

const SECTIONS = [{ href: '/preferences', label: 'Security', Icon: ShieldCheck }];

export function SettingsPageComponent() {
  const current = SECTIONS[0];

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="shrink-0 border-b p-3 md:w-52 md:border-r md:border-b-0">
        <h1 className="px-2.5 pt-2 pb-3 text-lg font-semibold tracking-tight">Settings</h1>
        <nav aria-label="Settings sections" className="flex gap-1 md:flex-col">
          {SECTIONS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === current.href ? 'page' : undefined}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-5 md:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Settings</span>
          <ChevronRight className="size-3.5" aria-hidden />
          <span aria-current="page" className="font-medium text-foreground">
            {current.label}
          </span>
        </nav>

        <section aria-labelledby="space-passwords" className="mt-8 flex max-w-3xl flex-col gap-4">
          <div>
            <h2 id="space-passwords" className="text-xl font-semibold tracking-tight">
              Space passwords
            </h2>
            <p className="mt-1 max-w-xl text-sm text-pretty text-muted-foreground">
              A space with a password asks for it before it opens, and its tasks and pages stay hidden, even in Trash.
              Once unlocked, it stays open in this browser for up to 12 hours. Vaults use their own passcode.
            </p>
          </div>
          <SpacePasswordsComponent />
        </section>
      </div>
    </div>
  );
}
