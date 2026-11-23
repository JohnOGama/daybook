'use client';

import { useTheme } from 'next-themes';
import { cn } from '@/shared/utils/cn';

// Fixed previews of each theme, so each card shows that theme whichever one is on.
const THEMES = [
  { id: 'light', label: 'Light', side: '#ededed', page: '#ffffff', ink: '#000000', line: '#ebebeb' },
  { id: 'dark', label: 'Dark', side: '#0a0a0a', page: '#000000', ink: '#ffffff', line: '#2e2e2e' },
];

export function AppearanceSettingsComponent() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Theme" className="grid max-w-md grid-cols-2 gap-3">
      {THEMES.map(({ id, label, side, page, ink, line }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={resolvedTheme === id}
          onClick={() => setTheme(id)}
          className={cn(
            'rounded-[20px] border-2 border-transparent bg-card p-2 text-left',
            resolvedTheme === id ? 'border-primary' : 'hover:border-border',
          )}
        >
          <span className="flex h-20 overflow-hidden rounded-xl" style={{ background: page }} aria-hidden>
            <span className="w-[30%]" style={{ background: side }} />
            <span className="flex flex-1 flex-col gap-1.5 p-2.5">
              <span className="h-1.5 w-3/5 rounded-full" style={{ background: ink }} />
              <span className="h-1.5 w-4/5 rounded-full" style={{ background: line }} />
              <span className="h-1.5 w-2/3 rounded-full" style={{ background: line }} />
            </span>
          </span>
          <span className="block px-1 pt-2 pb-0.5 text-sm font-semibold">{label}</span>
        </button>
      ))}
    </div>
  );
}
