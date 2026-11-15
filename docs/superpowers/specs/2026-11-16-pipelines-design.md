# Pipelines (CI/CD tracking)

Date: 2026-11-16. Approved mockup: https://claude.ai/artifact/SuiR8wM4kWEjDMRi5GN4sE (three boards: the space, a failed run in the drawer, Connect Jenkins).

## Why

The owner runs Jenkins and wants to see, inside Daybook, where each pipeline is right now. That means which stage is running, which one failed and why, and the messages stages send. They also want it the instant Jenkins reports, without opening Jenkins. Each stage calls a Daybook endpoint with a key that belongs to one space.

## Goals

1. **A new tool, Pipelines.** Its id is `pipelines`, its label "Pipelines" and its description "Track CI/CD runs from Jenkins", at `/pipelines`. One space holds any number of Jenkins jobs, grouped by job name.
2. **A report endpoint.** `POST /api/pipelines/report` with `Authorization: Bearer <key>`, called by Jenkins at each stage start and end and when the run finishes.
3. **Live.** A report changes every open screen of everyone who can see the space within about a second: the page, and the sidebar dot of a space you are not looking at.
4. **A dot per space in the sidebar.** Green: the last run of every job passed. Blue, pulsing: a stage is running now. Red: a job's last run failed or stopped reporting. Failed beats running beats passed. A space with no runs has no dot, and there is no legend.
5. **The space page.** As in the mockup's first board:
   - **One card per job.** The latest run's number, branch, commit, a "started" time, the status pill and the stages as steps: green ✓ with duration, blue spinner with elapsed time, red ✗, grey pending ones.
   - **The latest message line.** Which stage sent it, and how long ago.
   - **"Open in Jenkins"** when the report carried a URL.
   - **A "Recent runs" table.** Columns: run, status, stage reached, last message, duration and when.
6. **The run drawer.** As in the mockup's second board: clicking a run opens the right-side Drawer, the app's rule for right-side panels. It shows a timeline of every stage with times, its message, and for a failed stage the error text Jenkins sent, in monospace. Stages after a failure show "Skipped".
7. **Connect Jenkins.** As in the mockup's third board, in a Dialog:
   - **The key.** Shown once, with Copy, then only as "made on …, last used …". Replace key makes a new one and the old one stops working at once. Only the owner sees this part.
   - **The AI.** You paste the production Jenkinsfile, press "Add Daybook reporting", and get the same file with the reporting lines added, shown highlighted, with Copy.

## Non-goals

- Email or push notifications. The sidebar dot is how you find out, for now.
- Daybook changing Jenkins, reading the Jenkins API, or holding Jenkins credentials.
- Other CI systems by name. The endpoint is generic, but the setup copy and the AI target Jenkins only.
- Storing full build logs. Only the error text a stage sends, at most 8,000 characters.
- Re-running or cancelling builds from Daybook.

## Anti-goals

- **A Daybook outage or a slow reply failing a Jenkins build.** The helper times out after 5 s and ignores every error.
- **The key leaking.** It is never stored in plain text, never logged, never sent to the AI, never put in a URL, and never shown again after creation.
- **The AI silently changing what a pipeline does.** It may only add lines (see AI).
- **Pipeline text running as code in the browser.** Message and error are shown as text only, and the Jenkins URL becomes a link only if it is `http(s)`.
- **The space password leaking.** Run details are never sent to a browser that hasn't unlocked a locked space.

## Approaches (for the live part)

| | How | Trade-off |
|---|---|---|
| **A. One live connection per tab, per user (chosen)** | Each signed-in tab opens one WebSocket on the existing realtime server; the API pushes to everyone who can see the space. | Instant everywhere, reuses the presence server and its checks; needs a small "who can see this space" lookup. |
| B. Server-sent events | One HTTP stream per tab. | A second live mechanism next to the WebSocket; a proxy, the Next rewrite included, may hold the stream back. |
| C. Polling | Ask every few seconds. | Least code, but 3–5 s late and constant traffic from idle tabs. |

The owner picked **A**.

## Decided

### Reports

- **Body.** `{ job, run, stage?, status, message?, error?, url?, branch?, commit? }`, checked by zod:
  - `job` 1–200 characters; `run` is a positive integer, taken from a string (`env.BUILD_NUMBER`) or a number.
  - `stage` up to 100 characters; `message` up to 500; `error` up to 8,000, and a longer one keeps its last 8,000 characters.
  - `url` must be `http(s)` and at most 2,000 characters; `branch` up to 200; `commit` up to 64.
  - The body limit is 64 KB.
- **With `stage`:** `status` is `started`, `passed`, `failed` or `skipped`. `started` creates the stage, if it is new, as running, at the next position. The others finish it, creating it already finished if `started` never came.
- **Without `stage`:** the run finishes, with `status` `passed`, `failed` or `aborted` (shown as Failed with "Aborted"). That is the pipeline-level `post` block. Until then the run is running, even between stages, so the dot doesn't flash green between stages.
- **Run lifecycle.**
  - The first report for a new `(job, run)` creates the run.
  - Reports for the same run update it; the same stage reported twice updates that stage.
  - A run that is already finished still accepts stage reports, with a 200 reply. This tolerates a late `post` block, and the run's status follows the rules below.
- **Replies.**
  - 202 with no body on success.
  - 401 with no detail for a missing, wrong or replaced key, or for a space that is deleted or isn't a Pipelines space.
  - 400 for a bad body, naming the field.
  - 429 over 120 reports a minute per key: an in-memory counter, marked `ponytail:` as single-process like the realtime rooms.
- **Status rules,** computed on the server and stored:
  - **A stage** is `running`, `passed`, `failed` or `skipped`.
  - **A run** is `failed` if any stage failed or the run finished failed or aborted. It is `passed` if it finished passed. Otherwise it is `running`.
  - **Stale.** A running run with no report for 30 minutes counts as "Stopped reporting". The browser works this out from `updatedAt`, and it turns the dot red.
- **History.** Keep the 50 newest runs per job; older ones are deleted when a run is created.
- **Expected stages.** The pending grey stages and "4 of 5" come from the stages of that job's last finished run. The server returns them with the job; with none, only reported stages show.

### Keys

- **One key per Pipelines space**, in a new table `pipeline_keys`: `spaceId` (primary key), `keyHash` (SHA-256 hex, unique), `createdAt` and `lastUsedAt`.
- **Format:** `dbk_` plus 32 random base64url characters from `crypto.randomBytes`. It is hashed with plain SHA-256, which is enough for a random 192-bit key, and looked up by hash.
- **The owner only** can create or replace the key: `POST /pipelines/:spaceId/key` returns `{ key }` once. `GET /pipelines/:spaceId/key` returns only `{ createdAt, lastUsedAt }`.
  - Editors and viewers never see or replace it; it writes into the owner's space.
  - Replacing it overwrites the hash, so the old key gets 401 immediately.
- **The endpoint skips the session, Origin and space-password checks.** The key is the whole credential. Locks guard reading, not reporting.
- **Rows** are stored under the space owner's `userId`, like every shared write.

### Data

- **`pipeline_runs`:**
  - Fields: `id`, `spaceId`, `userId` (owner), `job`, `number`, `status`, `url`, `branch`, `commit`, `startedAt`, `updatedAt` and `finishedAt`.
  - A unique index on `(spaceId, job, number)`.
- **`pipeline_stages`:**
  - Fields: `id`, `runId` (cascade), `name`, `position`, `status`, `message`, `error`, `startedAt` and `finishedAt`.
  - A unique index on `(runId, name)`, and at most 50 stages per run.
- **Migration:** `ALTER TYPE space_tool ADD VALUE 'pipelines'` plus the three tables, through `db:generate`. The owner applies it.
- **The `pipelines` field.** `GET /spaces` gains it for Pipelines spaces: `passed`, `running` or `failed`, or null with no runs, worked out with the stale rule on the server too.

### Reading in the app

- **`GET /pipelines?spaceId=`** (`['pipelines', spaceId]`).
  - **Returns:** every job with its latest run, its stages and its expected stages, plus the 30 newest runs across jobs for the table.
  - **Checks:** `SpaceAccessService.resolve(…, 'view')` and `assertUnlocked` like every content read.
- **`GET /pipelines/runs/:id`** returns one run with all its stages, for the drawer, with the same checks via `resolveRow`.
- **Durations, "started 2m ago" and running timers** are computed in the browser from timestamps and tick every second. No server clock is shown as text.
- **The browser works out** the space's dot from `space.pipelines`, and stale from `updatedAt`.

### Live updates

- **The connection.** A per-user WebSocket, `/api/realtime/me`, handled by `RealtimeService` next to the space rooms.
  - It is checked on upgrade the same way, by Origin and session, with no space.
  - It is rechecked every 60 s for the session, closing with 4403.
  - `LiveUpdatesProviderComponent` in `AppShellComponent` opens it once per signed-in tab.
- **After a report** changes a run, the API sends `{ type: "pipeline", spaceId, status }` to the open user sockets of everyone who can see that space. It carries the space's new dot status and no run content.
  - **Who that is:** the owner plus users whose email matches a share on the space or any ancestor folder. That is a new `SpaceAccessService.viewerIds(spaceId)`, the reverse of `resolve`, with the same Vault and deleted-ancestor rules.
- **In the browser,** a message patches `space.pipelines` in `['spaces']`, so the dot changes at once. If that space's page is open, it also invalidates `['pipelines', spaceId]` and the open drawer's run.
  - The refetch goes through the normal read routes, so a locked space's details still need the unlock cookie.
  - The page shows the new stage as soon as that GET returns, in well under a second on a normal connection.
- **Presence rooms are unchanged.** The header avatars work on Pipelines spaces like everywhere else.

### AI: Add Daybook reporting

- **The route.** `POST /pipelines/ai/instrument` `{ spaceId, jenkinsfile }`, at most 100,000 characters. It needs edit access, like every AI route, and goes through `BudgetAiService.instrumentJenkinsfile`, off unless `GEMINI_API_KEY` is set.
- **What the AI is sent:** only the pasted text, the Daybook URL to call (`BETTER_AUTH_URL`, so reports go through the web origin's `/api` rewrite), and fixed instructions:
  - Add the `daybook()` helper.
  - Add `environment { DAYBOOK_URL = '…'; DAYBOOK_KEY = credentials('DAYBOOK_KEY') }`.
  - Add a `started` report as the first step of each stage, `post { success/failure }` stage reports, and a pipeline-level `post { success / failure / aborted }` run report.
  - Change nothing else.
- **The key is never sent.** The helper reads it from the Jenkins credential.
- **Like the diagram AI,** Gemini answers with the file as a list of lines plus one summary sentence, joined on the server.
- **The server checks the answer only adds lines.** The pasted file's lines, with trailing whitespace ignored, must appear in the answer in the same order and unchanged. It also checks that `credentials('DAYBOOK_KEY')` appears.
  - **On failure** it retries once with the problem, then refuses with "The AI changed your existing steps, so nothing was added. Try again, or add the lines by hand." and shows the helper snippet to copy instead.
- **The browser** marks added lines by comparing the two texts. That's the green highlight, using `page-diff.ts`'s line diff or the same idea. The result is never saved by Daybook.
- **The screen** states the privacy rule as in the mockup: only this text goes to the AI, never your key; take passwords or tokens out of the file first.

### Web

- `features/pipelines`:
  - `PipelinesPageComponent`, `JobCardComponent`, `RunsTableComponent`, `RunDrawerComponent` (shadcn Drawer, right) and `ConnectJenkinsDialogComponent` (shadcn Dialog).
  - Hooks `usePipelines` and `usePipelineRun`.
  - `pipeline-math.ts` for durations, stale, expected-stage progress and the space dot.
- **Placement:** add `pipelines` to `SpaceTool`, `TOOLS`, `TOOL_SCREENS` and the tool icon, a workflow icon. The route is `app/(app)/pipelines/page.tsx`, rendering only the page component.
- **The sidebar dot.** It sits at the right end of a Pipelines space's row, an 8 px circle: `status-done` green, `status-progress` blue with a pulse, or `destructive` red. It has an `aria-label` such as "Backend, a stage is running", and the pulse stops under reduced motion.
- **Colours on the page:** `status-done` green for success, `status-progress` blue for running and `destructive` red for failure. That is the same set as task status, which keeps the monochrome rule.
- **Loading:** Skullet with sample jobs.
- **Header:** `PresenceAvatarsComponent` and `ViewOnlyBadgeComponent` as on other tools. "Connect Jenkins" is shown to the owner; editors see the AI part only.
- **Duplicating:** a Pipelines space can't be duplicated, since the key and runs belong to it. Deleting it to Trash makes its key answer 401. Restoring it brings the key back.

### Docs

CLAUDE.md gains a "Pipelines rules" section, the new query keys, and the per-user live socket under Live presence.

## Constraints

- The report rate limiter and the user sockets live in one API process, like the realtime rooms, so the API must stay a single instance.
- **Reachability.** Jenkins must be able to reach the Daybook web origin. The owner runs Jenkins where it can, so this design assumes it.
  - **If Daybook goes on the public internet,** the README's "Before deploying" steps still apply.
  - **Separately,** the report endpoint gets its own per-key limiter, because it has no session.

## Left to the builder

- Exact zod schemas, file layout inside `features/pipelines` (API and web), and the Gemini prompt wording, within the rules above.
- How `viewerIds` walks ancestors: reuse `chain()` logic from `SpaceAccessService`.
- Tests:
  - **The endpoint:** key auth, every status transition, stale, retention at 51 runs, 429, 401 after replace and after trash, rows under the owner.
  - **The push:** goes to owner and share recipients only, never to strangers; carries no run content.
  - **The AI check:** accepts additions, refuses an altered or removed line.
  - **The web:** the dot rule, the drawer, live invalidation with a mocked socket, owner-only key UI, viewer read-only.

## Calls I made (the owner can overrule any)

- Blue for running (the task "in progress" colour), and failed beats running beats passed for the dot.
- A run stays running until its pipeline-level finish report, so the dot doesn't blink green between stages; 30 minutes without a report counts as stopped and shows red.
- Keep 50 runs per job; error text capped at 8,000 characters.
- Only the owner can see or replace the key; editors can use the AI helper.
- The live push carries only `{ spaceId, status }` and the page refetches, so locked-space content never travels over the socket.
- A Pipelines space can't be duplicated.
