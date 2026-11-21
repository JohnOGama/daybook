'use client';

import { LayoutGrid, Plug, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConnectedAppsComponent } from '@/features/connected-apps';
import { SpaceGroupsManagerComponent, SpacePasswordsComponent } from '@/features/spaces';

const SECTIONS = [
  { id: 'spaces', label: 'Spaces', Icon: LayoutGrid },
  { id: 'security', label: 'Security', Icon: ShieldCheck },
  { id: 'apps', label: 'Connected apps', Icon: Plug },
];

function ConnectedAppsSectionComponent() {
  // Read after mount so the server render and the first client render agree.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <section aria-labelledby="connected-apps" className="mt-8 flex max-w-3xl flex-col gap-4">
      <div>
        <h2 id="connected-apps" className="text-xl font-semibold tracking-tight">
          Connected apps
        </h2>
        <p className="mt-1 max-w-xl text-sm text-pretty text-muted-foreground">
          Apps like ChatGPT, Claude or Gemini that you've let log food, workouts and weight in your Fitness spaces. Disconnecting one stops it at once.
        </p>
        <p className="mt-2 max-w-xl text-sm text-pretty text-muted-foreground">
          To connect one, add <code className="rounded bg-muted px-1 py-0.5 text-foreground">{origin}/api/mcp</code> as a custom connector in the app.
        </p>
      </div>
      <ConnectedAppsComponent />
    </section>
  );
}

export function SettingsPageComponent() {
  const section = useSearchParams().get('section');
  const current = SECTIONS.find(({ id }) => id === section) ?? SECTIONS[0];

  return (
    <div className="min-h-full">
      <div className="min-w-0 px-4 py-5 md:px-8">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <nav aria-label="Settings sections" className="mt-4 flex gap-4 border-b">
          {SECTIONS.map(({ id, label, Icon }) => (
            <Link
              key={id}
              href={`/preferences?section=${id}`}
              aria-current={id === current.id ? 'page' : undefined}
              className="-mb-px flex items-center gap-2 border-b-2 border-transparent px-1 pb-2.5 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>

        {current.id === 'apps' ? (
          <ConnectedAppsSectionComponent />
        ) : current.id === 'spaces' ? (
          <section aria-labelledby="spaces" className="mt-8 flex max-w-3xl flex-col gap-4">
            <div>
              <h2 id="spaces" className="text-xl font-semibold tracking-tight">
                Groups
              </h2>
              <p className="mt-1 max-w-xl text-sm text-pretty text-muted-foreground">
                The groups your sidebar is split into, like Spaces or Work. Each holds its own folders and spaces; add one with the + beside its name in the sidebar.
              </p>
            </div>
            <SpaceGroupsManagerComponent />
          </section>
        ) : (
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
        )}
      </div>
    </div>
  );
}
