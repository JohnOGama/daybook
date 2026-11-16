# Pipelines rules

## Pipelines rules

- **Reports.** Jenkins reports to `POST /api/pipelines/report` with `Authorization: Bearer <key>`. There is no session, Origin or space-password check: the key is the credential, and locks guard reading, not reporting.
  - A bad, replaced or trashed key, or a non-Pipelines space, all answer the same bare 401.
  - The order of checks is key, then the limit (120 a minute per space, in memory), then the body (`reportSchema`, 64 KB, `reportBodyParser` in `main.ts`). Replies are 202, 401, 429 or 400.
- **Report shape.** With `stage`, status is `started|passed|failed|skipped`. Without it, the run finishes as `passed|failed|aborted`, sent by the helper's `daybookFinish`. A long `message` is cut to 500 characters and a long `error` keeps its last 8,000, so a report is never refused over length.
- **Status rules** (`PipelinesService.report`):
  - A finished stage never goes back to running, so late or repeated reports converge.
  - A run is failed if any stage failed or its finish status was failed or aborted; passed only on a passed finish; otherwise running, even between stages.
  - Each job keeps its 50 newest runs, a space its 500 newest across jobs (a job per branch is never pruned otherwise), and a run has at most 50 stages.
  - The run row is locked (`FOR UPDATE`) for the rest of each report, so parallel stages reporting at once apply one after the other.
  - Fields Jenkins sends as `null` (BUILD_URL before a Jenkins URL is set) count as not given.
  - Expected stages (the grey "still to come" steps, and "4 of 5") come from the job's last finished run.
- **The sidebar dot** (`shared/utils/pipeline-status.ts`, used by `GET /spaces` and the notifier, so there is no module cycle): failed beats running beats passed, from each job's newest run. A running run with no report for 30 minutes counts as failed, shown as "Stopped reporting"; the browser works out the same rule in `pipeline-math.ts`.
- **Keys.** There is one per space, `dbk_` plus 32 base64url characters, stored only as SHA-256 hex in `pipeline_keys` and shown once.
  - Only the owner can make or replace one (`/pipelines/:spaceId/key`); everyone else gets 404.
  - The web keeps the plain key in component state only, never in the query cache.
- **Pushes.** After each stored report, `RealtimePipelinesNotifier` works out `SpaceAccessService.viewerIds` at that moment and pushes only `{ type, spaceId, status }`.
  - The browser patches `space.pipelines` in `['spaces']` and invalidates `['pipelines', spaceId]` and `['pipeline-run']`.
  - Run content always comes through the checked read routes, so a locked space's details still need its unlock cookie.
- **The AI** (`POST /pipelines/ai/instrument`, `BudgetAiService.instrumentJenkinsfile`, edit access needed) is sent only the pasted Jenkinsfile and `BETTER_AUTH_URL`, never a key.
  - `addedOnly` refuses any answer that changes, removes or reorders a pasted line (line endings and trailing spaces ignored), or doesn't read `credentials('DAYBOOK_KEY')`. It retries once, then answers 502. The web then offers `helperSnippet` to add by hand, and marks added lines with `markAdded`. Nothing is saved.
  - Every added line must also be Daybook reporting (it mentions Daybook, or is a bare `post`/`success`/`try`/brace line), so the AI can't slip in a step.
  - The helpers (`JENKINS_HELPER` in the API, `helperSnippet` in the web, kept word for word in step) build JSON with `writeFile` and `groovy.json.JsonOutput`, so no Jenkins plugin is needed beyond core. They write one file per stage, so parallel stages can't swap reports, and catch every error, so reporting can never fail a build.
- **Space rules.** A Pipelines space can't be duplicated. Rows are hard-deleted with the space. Trashing it, or a folder above it, makes its key answer 401 (`spaceFor` uses `viewerIds`' ancestor rules), and restoring brings the key back.
