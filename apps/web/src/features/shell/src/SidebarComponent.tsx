'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Check, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sidebarCounts, type TaskStatus, useTaskFilters, useTasks } from '@/features/tasks';
import { useToday } from '@/shared/hooks/useToday';
import { authClient } from '@/shared/services/auth-client';
import { cn } from '@/shared/utils/cn';

type FilterRowProps = {
  label: string;
  dotClass: string;
  count: number;
  active: boolean;
  onClick: () => void;
};

function FilterRow({ label, dotClass, count, active, onClick }: FilterRowProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent',
        active && 'bg-accent font-medium',
      )}
    >
      <span className={cn('size-2 rounded-full', dotClass)} aria-hidden />
      {label}
      <span className="ml-auto text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

export function SidebarComponent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = useToday();
  const { data: tasks = [] } = useTasks({ from: today, to: today });
  const { filters, toggleStatus, toggleHigh } = useTaskFilters();
  const counts = sidebarCounts(tasks);

  const statusRows: { status: TaskStatus; label: string; dotClass: string; count: number }[] = [
    { status: 'todo', label: 'To do', dotClass: 'bg-slate-400', count: counts.todo },
    { status: 'in_progress', label: 'In progress', dotClass: 'bg-blue-500', count: counts.inProgress },
    { status: 'on_hold', label: 'On hold', dotClass: 'bg-violet-400', count: counts.onHold },
  ];

  async function handleSignOut() {
    await authClient.signOut();
    queryClient.clear();
    router.push('/sign-in');
  }

  return (
    <nav aria-label="Main" className="flex w-full flex-col">
      <div className="flex items-center gap-2.5 rounded-2xl border bg-card p-3 font-semibold">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Check className="size-4" strokeWidth={3} aria-hidden />
        </span>
        Daybook
      </div>

      <Link
        href="/list"
        className="mt-3.5 flex items-center gap-3 rounded-xl border bg-card px-2.5 py-2 text-sm font-medium"
      >
        <Calendar className="size-[18px]" aria-hidden />
        Today
        <span className="ml-auto grid h-5.5 min-w-5.5 place-items-center rounded-full bg-blue-100 px-1 text-xs font-semibold text-blue-700">
          {counts.open}
        </span>
      </Link>

      <p className="mx-2.5 mt-5 mb-1 text-[13px] font-medium text-muted-foreground">Status</p>
      {statusRows.map(({ status, ...row }) => (
        <FilterRow
          key={status}
          {...row}
          active={filters.statuses.includes(status)}
          onClick={() => toggleStatus(status)}
        />
      ))}

      <p className="mx-2.5 mt-5 mb-1 text-[13px] font-medium text-muted-foreground">Priority</p>
      <FilterRow
        label="High priority"
        dotClass="bg-orange-500"
        count={counts.high}
        active={filters.high}
        onClick={toggleHigh}
      />

      <button
        type="button"
        onClick={handleSignOut}
        className="mt-8 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-accent md:sticky md:top-[calc(100dvh-3.5rem)]"
      >
        <LogOut className="size-[18px]" aria-hidden />
        Sign out
      </button>
    </nav>
  );
}
