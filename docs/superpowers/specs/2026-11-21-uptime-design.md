# Uptime tool design

## Why

The owner runs several web apps, each with a backend API, and wants one place in Daybook to see at a glance whether each one is up: green when it works, red when it can't be reached, like the Pipelines dot. The approved mockup is the Uptime space (status table, 24-hour strip, summary tiles), a site's drawer (uptime, response time, incidents) and the Add site dialog.

## Goals

- An **Uptime** space lists sites. Each has a name, a URL and a kind: **Web app** (the page loads) or **API** (a health route such as `/api/health` answers).
- Daybook's API checks every site **every minute** from the server, whether or not anyone has Daybook open, and keeps **30 days** of results.
- Each site shows **Up** (green), **Slow** (amber: it answered, but took over 2 s) or **Down** (red, with the reason and how long it has been down), its last response time, a 24-hour strip of 48 half-hour bars, and its 24-hour uptime.
- The space shows three tiles: up now ("3 of 4"), uptime over the last 24 h across all sites, and incidents in the last 7 days.
- The sidebar dot for an Uptime space is red if any site is down, amber if any is slow, otherwise green. It updates live, like Pipelines.
- Clicking a site opens a drawer with uptime over 24 h, 7 days and 30 days, a 24-hour response-time chart, the incident list (start, end, length, reason), and Check now, Edit, Pause and Delete.
- Add site checks once straight away, so the new row is green or red at once.

## Non-goals

- No alerts: no email, push or sound when a site goes down. (Resend is already set up if that's wanted later.)
- No custom intervals, timeouts or thresholds per site; no keyword, JSON or header checks; no request headers or auth; no SSL-expiry checks; no public status page; no checks from more than one place.
- No private or local addresses (`localhost`, LAN IPs). Only public sites, for the same reason the job-posting fetcher refuses them.
- Daybook can't watch itself: if its own API is down, this page is down too.

## Anti-goals

- A single network blip must not turn a site red. A failed check is retried once after 5 s before it counts.
- Daybook must never be usable to probe the server's own network.
- Checks must never pile up or hammer a site: one check per site per minute at most, plus manual Check now, rate-limited.

## Approaches

1. **Daybook checks on a timer from the API (picked).** The checks run without anyone watching, so there's history and incidents, and the server sees the real status code.
2. **The browser checks while the page is open.** Rejected: CORS hides the response from other sites, so it can't tell a 500 from a 200, and there is no history.
3. **Apps report heartbeats, like Jenkins reports to Pipelines.** Rejected: it needs code in every app, and it proves the process runs, not that people can reach it.

## Constraints

- This is the app's first background job. It runs in the API process, which already has to be a single instance (live rooms live in memory), so a timer in that process is enough, with no queue or cron service. While the API is down nothing is checked. Those periods show as grey "no data" bars and count neither for nor against uptime.
- Every check goes out through the same guards as `features/jobs/src/posting-page.ts`: http(s) only, no cookies, at most 3 redirects, a 10 s timeout, and the resolved address of every connection must pass `isPublicAddress` (checked in the socket `lookup`, so redirects and DNS rebinding can't reach private addresses). Those guards move to a shared util so jobs and uptime both use them.
- The usual API rules apply: queries scoped by owner, `SpaceAccessService` on every route, `SpaceLockService.assertUnlocked` on reads, explicit `@Inject`, `.ts` relative imports, `parseOrThrow` with zod.

## How it works (decided)

**A check.** A `GET` of the URL with `User-Agent: Daybook-Uptime/1.0`.
- **The answer:** redirects are followed up to 3 times and the final answer is what counts. A 3xx still unresolved after the third hop counts as an answer. The body is never read (the response is drained and dropped).
- **Response time** is milliseconds from start to the final response's headers.
- **The result:**
  - **up:** a status from 200 to 399 within 10 s;
  - **slow:** the same, but over 2,000 ms;
  - **down:** anything else, with a short reason such as "502 Bad Gateway", "Timed out after 10 s", "Connection refused", "Address not found" or "Not a public address".
- **Retry:** a down result is retried once after 5 s, and only the retry's result is stored.

**The schedule.**
- **The tick:** a scheduler in the API ticks every 15 s and checks each site due a check: not paused, last checked over 60 s ago (or never), and in a space that is not in Trash, nor under a deleted folder or group.
- **Limits:** at most 5 checks run at once, and a site already being checked is skipped.
- **Pruning:** once an hour the scheduler deletes checks older than 30 days, and incidents that ended more than 30 days ago.
- **Start and stop:** it starts with the app and stops on shutdown. It does not run in tests (tests call the check and the service directly).

**Status and incidents.**
- **Stored on each site:** after each check, its current `status`, `lastCheckedAt`, `lastResponseMs`, `lastError` and `downSince`.
- **Incidents:** going down opens an incident (start time, first reason). The next up or slow check closes it (end time).
- **Pausing:** a paused site keeps its last status but shows as Paused (grey), takes no new checks, and doesn't count towards the dot or "up now".
- **The space's dot:** down beats slow beats up. A space with no sites, or only paused ones, has no dot.

**Live updates.** When a check changes a site's status, everyone who can see the space gets `{ type: 'uptime', spaceId, status }` (the space's dot status) on the per-user socket (`RealtimeService.sendToUsers`, recipients from `SpaceAccessService.viewerIds` at that moment). The message carries no site details, so a locked space stays locked. The browser patches `space.uptime` in `['spaces']` and invalidates `['uptime', spaceId]`. Pushes go out only on a change; an open Uptime page also refetches every 60 s to move response times and the strip along.

**Data.**
- `space_tool` gains `uptime`.
- `uptime_monitors`: `id`, `space_id` (cascade), `user_id` (owner), `name`, `url`, `kind` (`web` | `api`), `paused`, `position`, `status` (`up` | `slow` | `down` | null before the first check), `last_checked_at`, `last_response_ms`, `last_error`, `down_since`, `created_at`.
- `uptime_checks`: `id`, `monitor_id` (cascade), `checked_at`, `status`, `response_ms` (null when down), `http_status` (null when there was no answer), `error`. Index on (`monitor_id`, `checked_at`).
- `uptime_incidents`: `id`, `monitor_id` (cascade), `started_at`, `ended_at` (null while ongoing), `reason`. Index on (`monitor_id`, `started_at`).

**Routes** (all `AuthGuard`, all through `SpaceAccessService`; reads also `assertUnlocked`):
- `GET /uptime/:spaceId` (view): each site with its current status, last response, `lastError`, `downSince`, `paused`, the 48 half-hour bars for the last 24 h (each `up` | `slow` | `down` | `none`, the worst result in that half hour) and its 24-hour uptime. Also the space's 24-hour uptime and its incident count over 7 days.
- `GET /uptime/monitors/:id` (view): uptime over 24 h, 7 days and 30 days, 48 half-hour average response times for the last 24 h (null where there was none), and its incidents over 30 days, newest first, at most 50.
- `POST /uptime/:spaceId/monitors` (edit): `{ id, name, url, kind }`. Refuses URLs that aren't http(s), are longer than 2,000 characters, or whose host doesn't resolve to a public address (400 "Public addresses only"). At most 50 sites per space. Runs the first check before answering and returns the new site with its result.
- `PATCH /uptime/monitors/:id` (edit): `name`, `url`, `kind`, `paused`. A new URL runs a fresh check.
- `POST /uptime/monitors/:id/check` (edit): check now, at most once every 10 s per site (429 otherwise).
- `DELETE /uptime/monitors/:id` (edit): hard delete, with its checks and incidents, behind a confirm dialog. No Undo, because the history can't come back.
- Uptime percentages count up and slow checks as up, and down as down. Gaps with no check are left out.

**Space rules.** It can be shared like any space: viewers see everything, editors add, edit, pause and delete. It can't be duplicated. Trashing it stops its checks and restoring starts them again; its rows are hard-deleted when the space is.

**Web** (`features/uptime`, route `/uptime`), as in the mockup:
- **Header:** the space title, "Checked every minute · last check N s ago", and Add site.
- **Below it:** the three tiles, then the table (status pill, name with a Web/API badge and URL, the reason line when down, response, the 24-hour strip, 24-hour %). A row opens the drawer (shadcn `Sheet`). Add and Edit share one dialog.
- **Colours:** green is `status-done`, amber is `signal`, red is `destructive`, and grey is muted (paused or no data).
- **Elsewhere:**
  - The sidebar shows the dot beside the space, like `PipelineDotComponent`.
  - Viewers get no Add, Edit, Pause, Delete or Check now.
  - Loading uses Skullet over sample sites.
- **Query keys:** `['uptime', spaceId]`, refetched every 60 s while open, and `['uptime-monitor', id]`, read only while the drawer is open.

## Small calls made in writing this (the owner can change any)

- Check now works on a paused site and doesn't unpause it.
- A locked space keeps being checked (the password guards reading, as with Pipelines), and its sidebar dot still shows.
- Sites list in the order they were added; there is no reordering.
- Editing a site's URL keeps its history and incidents.

## Left to the builder

- The exact shape of the half-hour bucketing query (SQL `date_bin` or grouping in TypeScript over at most 1,440 rows per site).
- Whether the response-time chart is a small hand-written SVG line or uses a chart component the app already has; no new chart library.
- Where the shared fetch guards live (`shared/utils`) and how the scheduler is wired (a Nest provider with `onModuleInit` / `onApplicationShutdown`).
- Wording of reasons and empty states, in the app's usual plain style.
- `docs/claude/uptime.md` with the working rules, linked from `CLAUDE.md`, and the `web.md` query-key list.
