'use client';

import { CalendarDays, List, SquareKanban } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Skeleton } from 'skullet/react';
import { SpaceSettingsComponent, useActiveSpace } from '@/features/spaces';
import { cn } from '@/shared/utils/cn';
import { hasKanban } from './kanban-columns';

const TABS = [
  { href: '/list', label: 'List', Icon: List },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
];
const KANBAN_TAB = { href: '/kanban', label: 'Kanban', Icon: SquareKanban };

type TasksHeaderProps = { title: string; subtitle: string; subtitleLoading?: boolean };

export function TasksHeaderComponent({ title, subtitle, subtitleLoading }: TasksHeaderProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const kept = new URLSearchParams();
  for (const name of ['space', 'status', 'high']) {
    const value = params.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.size > 0 ? `?${kept}` : '';
  const space = useActiveSpace();
  const tabs = hasKanban(space) ? [...TABS, KANBAN_TAB] : TABS;

  return (
    <header>
      <div className="px-4 pt-5 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <Skeleton loading={subtitleLoading}>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
        </Skeleton>
      </div>
      <nav aria-label="Views" className="mt-3 flex gap-1.5 border-b px-2 md:px-4">
        {tabs.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={`${href}${query}`}
            aria-current={pathname === href ? 'page' : undefined}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground',
              pathname === href && 'border-foreground text-foreground',
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </Link>
        ))}
        {space && hasKanban(space) && <SpaceSettingsComponent space={space} />}
      </nav>
    </header>
  );
}
