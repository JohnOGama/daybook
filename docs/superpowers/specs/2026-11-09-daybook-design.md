# Daybook design

Date: 2026-11-09

Items marked **(my call)** were chosen by Claude, not the owner, and can be overruled.

## What it is

Daybook is a personal task manager organised around days. You open it, see what is on today, and work through it. Anything you don't finish comes with you to the next day, so nothing has to be re-planned or re-typed.

Anyone can sign up. Each person sees only their own tasks.

## Goals

- A Today list that shows the day's tasks, progress, status and priority at a glance.
- A Calendar with a big month grid and each day's tasks inside it.
- Unfinished tasks carry forward by themselves.
- Tasks can have subtasks, and a parent ticks itself off when all its subtasks are done.
- Filter by status and priority.
- Open sign-up with email, password and emailed codes.

## Non-goals (for now)

- Backlog. The owner removed it: no sidebar item, no tab. Every task lives on a day.
- Reminder or digest emails. Email is only for one-time codes.
- Sharing, teams, or assigning tasks to other people.
- Recurring tasks, task notes or descriptions, attachments **(my call)**.
- Drag and drop on the calendar **(my call)**.
- Changing email or password while signed in, deleting an account, dark mode, a marketing page **(my call)**.

## Anti-goals (my call)

These would make it a failure even if everything else worked:

- An unfinished task disappears, or appears twice.
- One person can see or change another person's tasks.

## Tech stack

Decided by the owner: Next.js, NestJS, Tailwind CSS, shadcn/ui (restyled to match the mockup), React Query for all server state, Drizzle ORM, Neon (Postgres), Better Auth, Resend.

Code structure and naming follow `CLAUDE.md` at the project root.

**(my call)**

- A pnpm workspace with `apps/web` (Next.js) and `apps/api` (NestJS). Pnpm is already installed.
- Drizzle, Better Auth and all business rules live in the Nest app. Next.js is only the interface.
- Next.js forwards `/api/*` to Nest, so the browser talks to one origin and sign-in cookies stay simple.
- The calendar is a plain CSS grid, not a calendar library.

## Look and layout

Match the approved mockup, which follows the owner's second sample image: light blue-grey sidebar, white rounded main panel, clean sans-serif, black underline on the active tab, blue checkboxes, soft coloured pills, circled expand arrows.

Reference: the approved mockup, [daybook-screens.html](daybook-screens.html), next to this document.

### Sidebar

- Daybook logo and name.
- Today, with a badge counting today's unfinished tasks.
- Status: To do, In progress, On hold, each with a count.
- Priority: High priority, with a count.
- Sign out, at the bottom.

Sidebar counts cover unfinished tasks on Today. Clicking a status or priority applies that filter to the current view **(my call)**.

On narrow screens the sidebar collapses behind a menu button **(my call)**.

### List tab

- Heading: the full date, such as "Monday, 9 November", then "Today · 6 tasks". Other days drop "Today".
- Previous day, next day, and a Today button.
- Show closed, Filters, New task.
- Progress card: percentage, "1 of 6 done", "3 high priority left", and a bar.
- Table columns: expand arrow, checkbox, task, status, priority, created date, action menu.
- Subtasks are indented beneath their parent. Parents expand and collapse.
- Finished tasks are struck through, with no status pill.

The ⋮ button beside the heading in the samples has no defined job, so it is left out until it does **(my call)**.

### Calendar tab

- Month title, previous month, next month, Today.
- Monday-first month grid **(my call)**.
- Each square lists that day's tasks, up to three, then "+N more" **(my call)**.
- Clicking a day opens that day in the List tab. Clicking a task opens it for editing **(my call)**.
- The same filters apply, and New task defaults to the day being viewed.

### Sign-in screens

Sign up, enter code, sign in, forgot password (email, then code and new password). `/` goes to Today when signed in and to sign in when not **(my call)**.

## How tasks behave

### Days and carrying forward

A task has a planned day. Which day it appears on depends on its state:

| Task | Appears on |
|---|---|
| Finished | The day it was finished |
| Unfinished, planned for today or later | Its planned day |
| Unfinished, planned for a past day | Today |

So a task moves forward and stays one task, and it never leaves a copy behind. The owner said tasks carry over automatically; "moves, not duplicates" was Claude's stated reading, and the owner did not correct it.

**(my call)** This is worked out when tasks are read, not by a nightly job, so nothing can fail overnight and no time zones need scheduling. "Today" is the person's local date, sent by the browser. Past days therefore show only what was finished on them, as in the mockup.

All unfinished tasks carry forward, including On hold **(my call)**.

### Status and priority

- Status is one of To do, In progress, On hold. New tasks start as To do.
- High priority is a separate on/off flag, so a task can be In progress and High priority.
- Finishing is the checkbox. Unticking returns the task to To do **(my call)**.

### Subtasks

- One level deep, as in the samples **(my call)**.
- Subtasks have their own checkbox, status, priority and created date **(my call)**.
- The table under "Days and carrying forward" applies to top-level tasks only. A subtask always appears wherever its parent appears, so a subtask finished earlier travels with an unfinished parent and counts on that day's progress **(my call)**.
- All subtasks finished → the parent ticks itself off (owner's rule).
- Unticking a subtask of a finished parent reopens the parent **(my call)**.
- Adding a subtask to a finished parent reopens the parent **(my call)**.
- Ticking a parent ticks all of its subtasks, and unticking a parent unticks all of them, so a parent with subtasks is finished exactly when they all are **(my call)**.
- Deleting the last unfinished subtask ticks the parent if finished subtasks remain **(my call)**.
- Deleting a parent deletes its subtasks **(my call)**.

### Progress card

Percent of the viewed day's tasks that are finished, rounded, counting parents and subtasks as separate tasks. This matches the sample, where 1 of 6 is 17%. It ignores filters and Show closed **(my call)**.

### Filters and Show closed

- Filter by status and by high priority. Filters combine.
- A subtask that matches also shows its parent, so it keeps its context **(my call)**.
- While any filter is on, finished tasks are hidden, since they have no status to match **(my call)**.
- Finished tasks show by default. Show closed turns them off and on **(my call)**.

### Creating and changing tasks

- New task asks for a title (1 to 200 characters), day, status and priority. The day defaults to the one being viewed **(my call)**.
- The row's ⋯ menu offers Edit, Add subtask, Move to another day and Delete **(my call)**.
- Status and priority can be changed from the pills in the row, as in the first sample.
- Delete asks for confirmation and moves the task to Trash.
- Double-clicking a task's label edits it in place. Enter or clicking away saves, and Escape cancels.
- Copy, in the ⋯ menu of a top-level task, duplicates it with its subtasks onto the same day as "… (copy)". Everything in the copy starts unfinished, and open items keep their status and priority **(my call)**.
- New accounts start empty; the sample tasks are not seeded **(my call)**.
- An empty day shows a short message and a New task button.

## Spaces

Approved mockups: [spaces.html](spaces.html) and [spaces-create.html](spaces-create.html), next to this document. This replaces the sidebar's Today item and its filter lists. Filters live in the page's Filters menu.

- A **space** (#) has a title and a tool, and opens that tool's screen. The tools are List and Notebook. Each List space also has a Kanban tab.
- A **Notebook** space holds pages, newest first, listed beside the editor. Add page creates a blank one. Pages are rich text and save automatically. The formatting toolbar stays hidden until text is highlighted, then floats beside the selection. Right-clicking a page offers Delete, which moves it to Trash after a confirmation **(my call)**.
- A **folder** only groups spaces. It has a title and no tool. Clicking it opens and closes the group, and its + creates a space inside it. Folders go one level deep.
- A new person sees a blank page asking for a title and a tool.
- The + beside "Spaces" opens one dialog with a Space/Folder switch. Folder hides the tool. The + on a folder has no switch.
- The number beside a space counts its unfinished tasks on today, including subtasks **(my call)**.
- Each List space has its own tasks, Today view, Calendar and carry-forward **(my call)**. Filters and counts cover the open space.
- The Settings button beside the Kanban tab offers "Carry over unfinished tasks" for that List space, on by default. Off, an unfinished task stays on its planned day instead of moving to today. Finished tasks never carry over either way.
- Existing tasks move into a first space named "My List" **(my call)**.
- Right-clicking a space offers Edit, Duplicate and Delete; a folder offers Edit and Delete. Double-clicking a label also edits it.
- Duplicating a space copies it into the same folder as "… (copy)" with its unfinished tasks, in order. Finished tasks stay behind **(my call)**.
- Delete moves spaces, folders, tasks and subtasks to a Trash page, after a confirmation. Restore puts an item back in its original folder, space or parent, and brings back any of those that are also in Trash. Nothing is removed permanently yet **(my call)**.
- Every change shows immediately and is undone with an error message if the server refuses it. A successful change does not refetch.
- A top-level task and its subtasks can be copied to another space from Copy to in the ⋯ menu. The copy keeps its title and starts unfinished **(my call)**.
- Tasks reorder by dragging the handle at the start of a row. Top-level tasks reorder among themselves, and subtasks within their parent **(my call)**.
- Spaces and folders reorder by dragging the grip that replaces a row's icon on hover. Top-level rows reorder among themselves, and spaces within their folder. New spaces go last **(my call)**.
- Pasting a multi-line list into New task's title, or choosing "Paste a list instead", opens a preview and creates the whole list at once on the chosen day. Indented lines become subtasks of the line above, to any depth. Checked items arrive unfinished. Add subtask works the same way, under that task **(my call)**.
- Subtasks can have their own subtasks, with no depth limit. Finishing a task finishes everything under it, and finishing the last open child finishes its parent, up the chain. Reopening a task or adding a child reopens its parents **(my call)**.
- Clear table moves every top-level task showing in the List table, with all its subtasks, to Trash after a confirmation. Tasks hidden by filters or Show closed stay **(my call)**.
- Right-clicking a row offers Edit, Duplicate and Delete. Subtasks offer Edit and Delete **(my call)**.
- Left out for now: the lock icon, "Browse all projects", and renaming or moving spaces **(my call)**.

## Accounts and email

The owner said email is for OTP and password needs. Claude's stated reading, not corrected:

- Sign up with email and password, then enter a 6-digit emailed code to verify the account.
- You can't sign in until the email is verified.
- Forgot password sends a 6-digit code, which is entered with the new password.
- The code screen has a Resend code button. Signing in with an unverified account sends a new code and goes to the code screen, so nobody gets stuck **(my call)**.

Use Better Auth's email OTP feature and its default code expiry and attempt limits **(my call)**. Resend delivers the emails.

Before anyone but the Resend account owner can receive codes, Resend needs a verified sending domain. The sender address is a setting, so no code changes when the domain arrives.

## Must hold

- Every task read and write is limited to the signed-in user, including subtask parents.
- API input is validated: title length, valid dates, valid status, and a subtask's parent cannot itself be a subtask.
- A parent and its subtasks change together in one transaction, so auto-tick can't half-apply.
- Accessibility basics: keyboard use, labelled controls, visible focus.
- Runnable checks cover: which day a task appears on, parent auto-tick and reopen, and one user being refused another's task.

## Left to the builder

Table and column details, API routes, exact component breakdown, migration workflow, and environment variable names.

Deployment is out of scope for this round. The first target is running locally against a Neon database.
