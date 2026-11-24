# Focus tool: design

Date: 2026-11-24

## Goal

A Pomodoro-style work timer that makes the time feel productive. You pull what you are working on straight from your List spaces, and every finished session is saved so you can see where the day and week went.

## Decisions (agreed with the owner)

- **A space tool**, `focus`, created like List or Budget. It can be shared (viewers see stats only) and can't be duplicated.
- **Pulls List tasks.** You pick from today's unfinished tasks in any List space you can see, or type what you're working on. The timer card can tick the task done ("Mark done"). Notebook pages and Job hunt jobs were offered and left out for now.
- **History with daily stats.** Finished focus sessions are saved with the task's title copied in. The page shows sessions and focus time today, a 7-day bar chart, and the week's time per task.
- **When a phase ends**, a tone plays and a desktop notification shows while the tab is in the background. Breaks do **not** start by themselves, and there is no "Done with it?" prompt.

## Shape

- **Data:** `focus_settings` (one row per space: focus, short break and long break minutes, and how many sessions until a long break) and `focus_sessions` (id from the browser, local `day`, `startedAt`, `minutes`, `taskId`, `taskTitle`).
- **API:** `GET /focus/:spaceId?from&to`, `PUT /focus/:spaceId/settings`, `POST /focus/:spaceId/sessions` (repeat ids are ignored).
- **Web:** one timer per browser in `FocusTimerProviderComponent`, mounted in the app shell and kept in `localStorage`, so it keeps running while you work in a List space. A small pill shows the time left on other pages. The timer rules are pure functions in `focus-math.ts`.

## Left out on purpose

- A retry queue for sessions lost to a dropped connection.
- Auto-starting breaks, and a sound choice or volume setting.
- Pulling from tools other than List.
- **Update, same day:** the task picker was taken out for now. Sessions still store a task when given one, so it can come back without a migration.
