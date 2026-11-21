# Calendar Task Spans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw a task that covers several days as one bar across those days in the List tool's Calendar.

**Architecture:** Browser only. Pure functions in `calendar-grid.ts` work out each task's span and pack one week's entries into lines; `MonthGridComponent` renders each week as a 7-column CSS grid where a bar spans grid columns.

**Tech Stack:** Next.js / React, Tailwind CSS v4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-calendar-task-spans-design.md`

## Global Constraints

- No API, database, `appearsOn` or carry-over change. Only `apps/web/src/features/tasks` and `docs/claude/tasks.md` change.
- Start = later of `localDay(new Date(task.createdAt))` and `task.plannedDay`; end = `task.completedOn ?? task.day`. If start > end, start = end.
- Label: `${title} · ${countOf(days, 'day')}` (`countOf` from `parse-task-list.ts`), only when the span is more than one day; `days` is the whole span, not the visible part.
- Colours: reuse `entryColor` in `MonthGridComponent` (status accent tint, `signal` for high priority, struck through when finished). No new colours.
- At most 3 lines per day (`VISIBLE_ENTRIES`); anything hidden counts in "+N more" on every day it covers.
- Subtasks: no bars; they stay single-day chips on their parent's `day`, right after the parent, as now.
- Don't `git commit` (owner's rule); finish with a ready-to-paste commit message. Run `graphify update .` from the repo root after code changes.

## Review Focus

1. A task finished before its planned day (planned next week, done today) shows as a one-day chip, never a negative span. Test in Task 1.
2. Carry-over off: an overdue open task's `day` equals its `plannedDay`, so it stays a one-day chip. Test in Task 1.
3. Four bars overlapping the same days: three show, no two on one line overlap, and each covered day says "+1 more". Test in Task 1.
4. A bar crossing Sunday→Monday shows on both week rows with its label on each, square end on the Sunday side and square start on the Monday side. Test in Task 1.
5. Clicking a bar opens the task and does not also navigate to the day list; clicking an empty spot in a day still navigates. Test in Task 2.

---

### Task 1: Span and week layout

**Files:**
- Modify: `apps/web/src/features/tasks/src/calendar-grid.ts` (replace `dayEntries`)
- Test: `apps/web/src/features/tasks/src/calendar-grid.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function taskSpan(task: Task): { start: string; end: string };
  export type WeekEntry = {
    task: Task;
    line: number;          // 0-based line within the week
    column: number;        // 0-based, Monday = 0
    span: number;          // visible columns in this week, >= 1
    days: number;          // whole span length in days, >= 1
    openStart: boolean;    // span starts before this week
    openEnd: boolean;      // span ends after this week
  };
  export function weekLayout(week: string[], tasks: Task[]): { entries: WeekEntry[]; more: number[] };
  // week: 7 days Mon..Sun; tasks: top-level tasks as the Calendar gets them;
  // entries: only lines < VISIBLE_ENTRIES; more[i]: hidden entries covering week[i].
  ```
- `dayEntries` is removed (its only caller is `MonthGridComponent`, rewritten in Task 2).

- [ ] **Step 1: Write the failing tests** (reuse the file's `task()` helper, extended to take overrides; use `createdAt` at `T12:00:00.000Z` so the local day is stable across time zones)

```ts
const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];

it('an open carried-over task spans from its planned day to today', () => {
  expect(taskSpan(task('m', { plannedDay: '2026-11-18', day: '2026-11-21', createdAt: '2026-11-18T12:00:00.000Z' })))
    .toEqual({ start: '2026-11-18', end: '2026-11-21' });
});
it('a task created after its planned day starts on its created day', () => { /* plannedDay 11-16, created 11-19, day 11-21 → start 11-19 */ });
it('a finished task ends on completedOn', () => { /* plannedDay 11-18, completedOn 11-20, day 11-20 → { 11-18, 11-20 } */ });
it('a task finished before its planned day is a single day', () => { /* plannedDay 11-25, completedOn 11-20, day 11-20 → { 11-20, 11-20 } */ });
it('an overdue task with carry-over off stays on its planned day', () => { /* plannedDay 11-18, day 11-18, created 11-10 → { 11-18, 11-18 } */ });

it('places a four-day task as one entry', () => {
  const { entries } = weekLayout(week, [task('m', { plannedDay: '2026-11-18', day: '2026-11-21', createdAt: '2026-11-18T12:00:00.000Z' })]);
  expect(entries.map(({ task, ...rest }) => ({ id: task.id, ...rest })))
    .toEqual([{ id: 'm', line: 0, column: 2, span: 4, days: 4, openStart: false, openEnd: false }]);
});
it('cuts a span at both week edges', () => {
  // plannedDay 11-12, day 11-25 → column 0, span 7, days 14, openStart true, openEnd true
});
it('puts subtasks as one-day chips right after their parent on its day', () => {
  // single-day parent on 11-18 with subtask s → entries parent line 0, s line 1, both column 2 span 1
});
it('never overlaps entries on a line and counts the rest per day', () => {
  // four tasks all spanning 11-17..11-19 → lines 0,1,2 shown; more = [0,1,1,1,0,0,0]
});
it('reuses a free line for a later task', () => {
  // a: 11-16..11-17, b: 11-17..11-18, c: 11-19 → c.line === 0
});
```

- [ ] **Step 2: Run and see them fail**

Run: `pnpm --filter web exec vitest run src/features/tasks/src/calendar-grid.test.ts`
Expected: FAIL, `taskSpan` / `weekLayout` not exported.

- [ ] **Step 3: Implement `taskSpan` and `weekLayout` in `calendar-grid.ts`**

Entries for the week: each top-level task whose span meets the week, followed by its subtasks (`allInTree(task).slice(1)`) as one-day entries on `task.day` when that day is in the week. Order for packing: by visible start column, then longer visible span first; `Array.prototype.sort` is stable, so equal ones keep API order. Packing: each entry takes the lowest line with none of its columns taken. Entries on line >= `VISIBLE_ENTRIES` are dropped from `entries` and add 1 to `more` for each column they cover. Day difference: compare `YYYY-MM-DD` strings and count with `addDays`, or `Date.UTC` maths; no time zone involved.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter web exec vitest run src/features/tasks/src/calendar-grid.test.ts`
Expected: PASS. (`tsc` will fail until Task 2 removes the `dayEntries` import; that's expected.)

---

### Task 2: Month grid renders weeks with bars

**Files:**
- Modify: `apps/web/src/features/tasks/src/MonthGridComponent.tsx`
- Create: `apps/web/src/features/tasks/src/MonthGridComponent.test.tsx`
- Modify: `docs/claude/tasks.md` (one rule line)

**Interfaces:**
- Consumes: `weekLayout`, `WeekEntry` from Task 1; props of `MonthGridProps` unchanged, so `CalendarPageComponent` doesn't change.

- [ ] **Step 1: Write the failing component tests** (render with `tasks` built like Task 1's helper, `days = monthGrid('2026-11')`, `today = '2026-11-21'`; mock `next/navigation`'s `useRouter` with a `push` spy, as `ReadOnlyTasks.test.tsx` sets things up)

```ts
it('shows a four-day task once, with its length', () => {
  // one task m: plannedDay 11-18, day 11-21
  expect(screen.getAllByRole('button', { name: 'Migration site · 4 days' })).toHaveLength(1);
});
it('shows a one-day task without a length', () => {
  expect(screen.getByRole('button', { name: 'Standup' })).toBeInTheDocument();
});
it('opens the task from its bar without opening the day', async () => {
  await user.click(screen.getByRole('button', { name: 'Migration site · 4 days' }));
  expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'm' }));
  expect(push).not.toHaveBeenCalled();
});
it('shows +N more on each day a hidden bar covers', () => {
  // four tasks spanning 11-17..11-19 → three "+1 more" texts
  expect(screen.getAllByText('+1 more')).toHaveLength(3);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `pnpm --filter web exec vitest run src/features/tasks/src/MonthGridComponent.test.tsx`
Expected: FAIL (no "· 4 days" label yet).

- [ ] **Step 3: Rewrite `MonthGridComponent`**

- Weekday header row as now. Then one block per 7 days of `days`, each a `grid grid-cols-7` with explicit rows: day-number row, 3 entry lines, a "+N more" row, then `1fr`; keep the cell minimum height (`min-h-23`) and the outer `min-w-[640px]` scroll.
- Per day, a background cell at `gridColumn: i + 1, gridRow: '1 / -1'` that carries today's borders, out-of-month shading, `onClick={() => router.push(href)}` and the day-number `Link`, exactly as the current cell does.
- Per `WeekEntry`, the existing chip button at `gridColumn: `${column + 1} / span ${span}``, `gridRow: line + 2`, above the background (`relative z-10`), with `entryColor(task)`, `rounded-l-none` when `openStart`, `rounded-r-none` when `openEnd`, `stopPropagation` and `onSelectTask` as now. Text: the title, plus ` · ${countOf(days, 'day')}` when `days > 1`.
- Per day with `more[i] > 0`, "+{more} more" in the "+N more" row of its column.

- [ ] **Step 4: Run the tests, type-check and build**

Run: `pnpm --filter web exec vitest run src/features/tasks` and `pnpm --filter web exec tsc --noEmit`
Expected: all PASS, including `ReadOnlyTasks.test.tsx` and `calendar-grid.test.ts`.

- [ ] **Step 5: Look at it**

Run the app (`pnpm run dev`), open the Calendar for a List space with a task planned on an earlier day and still open, and check the bar, its accent, a week-crossing bar and "+N more".

- [ ] **Step 6: Update the rules and the graph**

Add to `docs/claude/tasks.md` under Task rules: "The Calendar draws a task covering several days as one bar from the later of its created and planned day to its finished day, or the day it shows on (`taskSpan`, `weekLayout` in `calendar-grid.ts`); subtasks stay one-day chips." Then run `graphify update .` from the repo root.

- [ ] **Step 7: Hand over a commit message** (don't commit)
