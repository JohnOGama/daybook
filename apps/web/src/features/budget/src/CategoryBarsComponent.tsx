import { formatMoney } from './budget-money';

type CategoryBarsProps = { rows: { id: string; label: string; amount: number }[]; total: number; currency: string };

// One series ranked by size: a bar per category, its share and amount labelled beside it.
export function CategoryBarsComponent({ rows, total, currency }: CategoryBarsProps) {
  const largest = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              {formatMoney(row.amount, currency)}
              <span className="ml-2 inline-block w-9 text-right text-xs text-muted-foreground">
                {total > 0 ? `${Math.round((row.amount / total) * 100)}%` : ''}
              </span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-foreground/80" style={{ width: `${(row.amount / largest) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
