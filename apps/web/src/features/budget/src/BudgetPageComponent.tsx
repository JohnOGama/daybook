"use client";

import {
  ArrowLeftRight,
  CalendarDays,
  ChartColumn,
  CloudOff,
  ChevronLeft,
  ChevronRight,
  Flag,
  HandCoins,
  House,
  Plus,
  Repeat,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "skullet/react";
import { useActiveSpace } from "@/features/spaces";
import { Button } from "@/shared/components/ui/button";
import { useToday } from "@/shared/hooks/useToday";
import { cn } from "@/shared/utils/cn";
import { useBudget } from "../hooks/useBudget";
import { useBudgetMutations } from "../hooks/useBudgetMutations";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import {
  accountBalances,
  formatMonth,
  monthOf,
  shiftMonth,
  sum,
} from "./budget-math";
import { totalInBase } from "./budget-currency";
import { formatMoney } from "./budget-money";
import {
  BUDGET_VIEWS,
  type BudgetEntry,
  type BudgetView,
  type EntryInput,
  type ScheduleInput,
} from "./budget-types";
import { BudgetCalendarComponent } from "./BudgetCalendarComponent";
import { BudgetDebtsComponent } from "./BudgetDebtsComponent";
import { BudgetForecastComponent } from "./BudgetForecastComponent";
import { BudgetGoalsComponent } from "./BudgetGoalsComponent";
import { BudgetLimitsComponent } from "./BudgetLimitsComponent";
import {
  BudgetOverviewComponent,
  type BudgetViewProps,
} from "./BudgetOverviewComponent";
import { BudgetRecurringComponent } from "./BudgetRecurringComponent";
import { BudgetReportsComponent } from "./BudgetReportsComponent";
import { BudgetSettingsComponent } from "./BudgetSettingsComponent";
import { BudgetTransactionsComponent } from "./BudgetTransactionsComponent";
import {
  EntrySheetComponent,
  type EntrySheetState,
} from "./EntrySheetComponent";
import { sampleBudget } from "./sample-budget";
import {
  ScheduleSheetComponent,
  type ScheduleSheetState,
} from "./ScheduleSheetComponent";
import { dueOccurrences } from "./schedule-math";

const TABS: { view: BudgetView; label: string; Icon: typeof House }[] = [
  { view: "overview", label: "Overview", Icon: House },
  { view: "transactions", label: "Transactions", Icon: ArrowLeftRight },
  { view: "calendar", label: "Calendar", Icon: CalendarDays },
  { view: "recurring", label: "Recurring", Icon: Repeat },
  { view: "budgets", label: "Budgets", Icon: Target },
  { view: "goals", label: "Goals", Icon: Flag },
  { view: "debts", label: "Debts", Icon: HandCoins },
  { view: "forecast", label: "Forecast", Icon: TrendingUp },
  { view: "reports", label: "Reports", Icon: ChartColumn },
  { view: "settings", label: "Settings", Icon: Settings },
];

const SCREENS: Record<BudgetView, (props: BudgetViewProps) => React.ReactNode> =
  {
    overview: BudgetOverviewComponent,
    transactions: BudgetTransactionsComponent,
    calendar: BudgetCalendarComponent,
    recurring: BudgetRecurringComponent,
    budgets: BudgetLimitsComponent,
    goals: BudgetGoalsComponent,
    debts: BudgetDebtsComponent,
    forecast: BudgetForecastComponent,
    reports: BudgetReportsComponent,
    settings: BudgetSettingsComponent,
  };

const isMonth = (value: string | null): value is string =>
  Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));

export function BudgetPageComponent() {
  const params = useSearchParams();
  const space = useActiveSpace();
  const today = useToday();
  const { data, isPending, isError } = useBudget();
  const [sheet, setSheet] = useState<EntrySheetState>(null);
  const [scheduleSheet, setScheduleSheet] = useState<ScheduleSheetState>(null);
  const { recordOccurrence } = useBudgetMutations();
  const { online, waiting } = useOfflineQueue();
  const autoRecorded = useRef(new Set<string>());

  const requestedView = params.get("view") as BudgetView;
  const view = BUDGET_VIEWS.includes(requestedView)
    ? requestedView
    : "overview";
  const requestedMonth = params.get("month");
  const month = isMonth(requestedMonth) ? requestedMonth : monthOf(today);
  const sample = useMemo(() => sampleBudget(today), [today]);
  const budget = data ?? sample;

  const hrefFor = useCallback(
    (change: { view?: BudgetView; month?: string }) => {
      const next = new URLSearchParams({ space: space?.id ?? "" });
      const nextView = change.view ?? view;
      const nextMonth = change.month ?? month;
      if (nextView !== "overview") next.set("view", nextView);
      if (nextMonth !== monthOf(today)) next.set("month", nextMonth);
      return `/budget?${next}`;
    },
    [space?.id, view, month, today],
  );
  const openEntry = useCallback(
    (entry: BudgetEntry) => setSheet({ mode: "edit", entry }),
    [],
  );
  const addEntry = useCallback(() => setSheet({ mode: "add" }), []);
  const recordEntry = useCallback(
    (draft: Partial<EntryInput>) => setSheet({ mode: "add", draft }),
    [],
  );
  const addSchedule = useCallback(() => setScheduleSheet({ mode: "add" }), []);
  const openSchedule = useCallback(
    (scheduleId: string) => {
      const schedule = data?.schedules.find(({ id }) => id === scheduleId);
      if (schedule) setScheduleSheet({ mode: "edit", schedule });
    },
    [data],
  );
  function repeatEntry(draft: Partial<ScheduleInput>) {
    setSheet(null);
    setScheduleSheet({ mode: "add", draft });
  }

  const due = data ? dueOccurrences(data, today) : [];
  const needsConfirming = due.filter(
    (occurrence) => !occurrence.schedule.autoRecord,
  ).length;

  // Schedules set to record themselves catch up whenever the budget is open; the server refuses any day already recorded.
  useEffect(() => {
    for (const occurrence of due) {
      const key = `${occurrence.schedule.id}|${occurrence.day}`;
      if (!occurrence.schedule.autoRecord || autoRecorded.current.has(key))
        continue;
      autoRecorded.current.add(key);
      recordOccurrence(occurrence, today);
    }
  });

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this budget. Please try again.
      </p>
    );
  }

  const Screen = SCREENS[view];
  const total = totalInBase(budget, accountBalances(budget, today));

  return (
    <div className="pb-16">
      <header>
        <div className="flex items-start justify-between gap-3 px-4 pt-5 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {space?.title ?? "Budget"}
            </h1>
            <Skeleton loading={isPending}>
              <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                {formatMoney(total, budget.currency)} across{" "}
                {budget.accounts.length}{" "}
                {budget.accounts.length === 1 ? "account" : "accounts"}
              </p>
            </Skeleton>
          </div>
          <Button
            onClick={addEntry}
            disabled={isPending}
            aria-label="Add entry"
            className="shrink-0"
          >
            <Plus aria-hidden />
            <span className="hidden sm:inline">Add entry</span>
          </Button>
        </div>
        <nav
          aria-label="Budget views"
          className="mt-3 flex gap-1.5 overflow-x-auto border-b px-2 md:px-4"
        >
          {TABS.map(({ view: tab, label, Icon }) => (
            <Link
              key={tab}
              href={hrefFor({ view: tab })}
              aria-current={view === tab ? "page" : undefined}
              aria-label={
                tab === "recurring" && needsConfirming > 0
                  ? `${label}, ${needsConfirming} due`
                  : undefined
              }
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground",
                view === tab && "border-foreground text-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
              {tab === "recurring" && needsConfirming > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1.5 text-[11px] font-semibold text-black tabular-nums">
                  {needsConfirming}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-4 md:px-6">
        {(!online || waiting > 0) && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
          >
            <CloudOff
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span>
              {online
                ? `Sending ${waiting} ${waiting === 1 ? "change" : "changes"}…`
                : `You're offline. Keep recording: changes show here straight away and are sent when you're back online.${
                    waiting > 0
                      ? ` ${waiting} waiting. Keep this tab open until they're sent.`
                      : ""
                  }`}
            </span>
          </div>
        )}
        <Skeleton loading={isPending} label="Loading budget">
          <Screen
            budget={budget}
            month={month}
            today={today}
            onOpenEntry={openEntry}
            onAddEntry={addEntry}
            onRecordEntry={recordEntry}
            onAddSchedule={addSchedule}
            onOpenSchedule={openSchedule}
            hrefFor={hrefFor}
          />
        </Skeleton>
      </div>

      {data && (
        <>
          <EntrySheetComponent
            budget={data}
            today={today}
            state={sheet}
            onClose={() => setSheet(null)}
            onRepeat={repeatEntry}
          />
          <ScheduleSheetComponent
            budget={data}
            today={today}
            state={scheduleSheet}
            onClose={() => setScheduleSheet(null)}
          />
        </>
      )}
    </div>
  );
}

function MonthSwitcher({
  month,
  today,
  hrefFor,
}: {
  month: string;
  today: string;
  hrefFor: BudgetViewProps["hrefFor"];
}) {
  const current = monthOf(today);
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label="Previous month">
        <Link href={hrefFor({ month: shiftMonth(month, -1) })}>
          <ChevronLeft aria-hidden />
        </Link>
      </Button>
      <h2
        className="min-w-36 text-center text-sm font-semibold tabular-nums"
        aria-live="polite"
      >
        {formatMonth(month)}
      </h2>
      <Button asChild variant="ghost" size="icon" aria-label="Next month">
        <Link href={hrefFor({ month: shiftMonth(month, 1) })}>
          <ChevronRight aria-hidden />
        </Link>
      </Button>
      {month !== current && (
        <Button asChild variant="outline" size="sm" className="ml-2">
          <Link href={hrefFor({ month: current })}>This month</Link>
        </Button>
      )}
    </div>
  );
}
