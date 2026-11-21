# Task rules

## Task rules

- A task's visible day is computed on read by `appearsOn` in `task-rules.ts`, with no nightly job: finished tasks show on `completedOn`, unfinished future tasks on `plannedDay`, and overdue tasks on today, or on `plannedDay` when the space has `carryOver` off.
- "Today" is the user's local date, sent by the browser (`useToday`) on each relevant request. Don't use the server's clock for it.
- Subtasks nest to any depth and appear with their top-level task. Only top-level tasks have `plannedDay`, enforced by a DB check. Finishing or reopening walks the whole tree: down through descendants and up through ancestors.
- Changes that affect a parent and its subtasks run in one transaction using `lockFamily`, so auto-tick and reopen can't half-apply.
- Tasks and spaces are soft-deleted with `deletedAt`, so queries must filter on `isNull(deletedAt)`. Deleting a parent task marks only the parent; its subtasks are hidden because they load through it. `TrashService` restores missing parents, spaces and folders.
- The Calendar draws a task covering several days as one bar from the later of its created and planned day to its finished day, or the day it shows on (`taskSpan`, `weekLayout` in `calendar-grid.ts`). Bars are packed into three lines per week, hidden ones count in each covered day's "+N more", and subtasks stay one-day chips.
