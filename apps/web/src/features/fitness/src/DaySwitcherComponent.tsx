import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { addDays, relativeDayLabel } from '@/shared/utils/date-formatter';

type DaySwitcherProps = { day: string; today: string; hrefFor: (change: { day: string }) => string; children?: ReactNode };

// Steps the shown day back and forth; `children` sit at the right-hand end of the row.
export function DaySwitcherComponent({ day, today, hrefFor, children }: DaySwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label="Previous day">
        <Link href={hrefFor({ day: addDays(day, -1) })}>
          <ChevronLeft aria-hidden />
        </Link>
      </Button>
      <h2 className="min-w-32 text-center text-sm font-semibold">{relativeDayLabel(day, today)}</h2>
      <Button asChild variant="ghost" size="icon" aria-label="Next day">
        <Link href={hrefFor({ day: addDays(day, 1) })}>
          <ChevronRight aria-hidden />
        </Link>
      </Button>
      {day !== today && (
        <Button asChild variant="outline" size="sm" className="ml-1">
          <Link href={hrefFor({ day: today })}>Today</Link>
        </Button>
      )}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
