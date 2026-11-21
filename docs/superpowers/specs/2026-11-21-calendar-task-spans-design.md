# Calendar task spans

## Why

A carried-over task shows on one day only: today. On the Calendar you can't see that "Migration site" has been open since 18 Nov. A task that runs over several days should be drawn as a bar across those days, so you can see at a glance how long it has been going (or how long it took).

## What it does

- A top-level task whose span covers more than one day is drawn as one bar across those days in the List tool's Calendar, with its title and length once per week row: "Migration site · 4 days".
- **Start** is the later of the task's created day (`createdAt` in local time) and its `plannedDay`. A task added today for next week starts next week, not today.
- **End** is `completedOn` for a finished task, and the day it shows on (`day`, today when carried over) for an open one.
- One-day tasks look as they do now, as chips.
- Finished tasks keep their bar, struck through like finished chips are now.
- A bar that starts before the first visible day is cut there with a square left end; one that runs past the last visible day gets a square right end. A bar crossing a week boundary continues on the next week row.
- **Colour:** bars use the same accents as chips: the status accent (`status-todo`, `status-progress`, `status-hold`) as a tint with the status colour for text, and `signal` for high priority. *(My call: "accent colour" read as the existing status/priority accents, so a bar and a chip of the same task look alike. Say if you meant one accent, `signal`, for every bar.)*
- Each day still shows at most 3 lines; whatever doesn't fit is counted in that day's "+N more". Clicking a bar opens the task, as clicking a chip does now; clicking the empty part of a day still opens that day's list.

## Non-goals

- No change to the API, the database, carry-over or `appearsOn`.
- No span in the List (day) view or Kanban.
- No dragging bars to change dates.
- Subtasks get no bars of their own. They keep showing as chips on the day the task shows on now (its end day), as they do today. *(My call.)*

## Approaches

1. **Week rows with lanes (picked).** Each week is a row; tasks are packed into lanes and a multi-day task is one element spanning grid columns. Bars line up across days. Needs a rewrite of `MonthGridComponent` and a lane-packing function.
2. **A piece of the bar in each day cell.** Smaller change, but nothing keeps a task on the same line from day to day, so bars step up and down; fixing that needs the lanes from 1 anyway.

Picked 1 because 2 only looks right once it has 1's lanes.

## How (decided)

- Browser only, in `features/tasks`. A pure function in `calendar-grid.ts` works out each task's span and packs a week's tasks into lanes (longer and earlier spans first), with unit tests next to the existing `calendar-grid.test.ts`.
- `MonthGridComponent` renders weeks as rows: the day-number header row, then lanes as a 7-column CSS grid where a bar uses `grid-column: start / span n`.
- The Calendar query keeps its range; tasks already arrive with `plannedDay`, `completedOn`, `createdAt` and `day`.

## Left to the builder

- Exact lane-packing order and tie-breaks, as long as bars don't overlap and stay on one lane within a week.
- How "+N more" is counted per day when a hidden bar covers several days (each day it covers counts it).
