# Job hunt rules

## Job hunt rules

- A job's status is `saved`, `applied`, `interviewing`, `offer` or `rejected` (shown as "Not accepted"). The current status is a column; every change also appends `{ kind: 'status', status, day }` to the job's `events` JSON, and a follow-up appends `{ kind: 'followUp', day }`. "Applied" is the earliest `applied` day, always read from days, never from array order.
- Waiting days, the "no reply" nudge (7 days; "close it?" from 30), the tiles, tab counts, search and sort are computed in the browser by `features/jobs/src/jobs-math.ts`. Nothing ever changes a status by itself.
- Adding from a link: the browser calls `POST /jobs/ai/read-posting`, and only creates the job once the details come back; a login wall, an unreadable page or a non-posting opens the manual form with the reason instead. Pasting a link already in the list (compared with `normalizeLink`) selects that job.
- The server fetches posting pages itself in `posting-page.ts`: http(s) only, no cookies, at most 3 redirects, 10 s, 2 MB, and every connection's resolved address must pass `isPublicAddress` (checked in the socket `lookup`, so redirects and DNS rebinding can't reach private addresses).
- The AI goes through `BudgetAiService` (`readPosting`, `matchJob`). `readPosting` is sent only that page's text and JobPosting JSON-LD; `matchJob` only the CV and one job's role, company and description. Notes, statuses and other jobs are never sent. The match runs when a job is added (if there is a CV and a description) and on Recheck; editing the CV marks matches stale instead of re-running them.
- The CV is plain text in `job_profiles`, one per space. Jobs are hard-deleted with Undo (re-created with the same id, events and match). A Job hunt space cannot be duplicated and has no offline queue.
