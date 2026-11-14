# Job hunt design

Date: 2026-11-14

Items marked **(my call)** were chosen by Claude, not the owner, and can be overruled. The owner approved the layout in the mockup at `.superpowers/brainstorm/1144-1794599015/content/job-hunt.html` (not committed; the sketch below records it).

## What it is

Job hunt is a seventh tool for a space, beside List, Notebook, Book, Vault, Budget and Fitness. It is for one person keeping track of the jobs they find and apply for: paste a posting's link, let the AI fill in the role and say how well it matches them, then move the job through its statuses as things happen. Tailoring a CV to a job with AI is the next project and builds on this one.

## Goals

- Add a job by pasting its link. The AI reads the posting and fills in role, company, location, work mode, salary, employment type and description.
- Add a job by hand when there is no link, or when the link cannot be read.
- A new job has no application status yet ("Saved"). Marking it applied starts its status trail: Applied, Interviewing, Offer, or Not accepted.
- Every status change is kept with its date, so the job shows its history and how long it has been waiting.
- See at a glance which applications have gone quiet, and record a follow-up.
- See how well each job matches the owner, as a percentage with the skills they have and the ones they are missing.
- See the search as a whole: applied this week, waiting on a reply, interviews coming up, reply rate.

## Non-goals (for now)

- Tailoring the CV to a job with AI. It is the next project. The panel shows a disabled "Tailor my CV" spot marked "Coming next".
- Uploading a CV file (PDF, Word). The CV is pasted as plain text. **(my call)**
- Reading email or calendars to detect replies or interviews; reminders and notifications.
- A board view with columns per status. The table can gain a Board toggle later if the owner misses it. **(my call)**
- Contacts as their own records. A recruiter's name goes in notes.
- Working offline, and duplicating a Job hunt space. **(my call)**

## Anti-goals

- A status changing by itself. Only the owner moves a job; "no reply" is a nudge, never a status.
- Half-saved jobs: a link that is still being read, or failed to read, never leaves a stored row behind.
- The whole job list, notes or other jobs sent to the AI. Each AI call is about one posting.
- The match presented as fact. It is labelled "AI estimate".
- Fetching pages with the owner's cookies or logging in to job sites on their behalf.
- One person seeing or changing another person's data.

## The screen

```
Job hunt                                               [+ Add manually]
[🔗 https://careers.example.com/jobs/123          AI fills in…  (Add job)]

[Applied this week 5] [Waiting on a reply 9] [Interviewing 3] [Reply rate 27%]

[All 27] [Saved 6] [Applied 14] [Interviewing 3] [Offer 1] [Not accepted 3]   (search)

Role                              Match   Status          Applied
N  ░░░░░░░░░ (reading…)           ░░      Reading the posting…
A  Frontend Engineer              ◔ 82%   ● Interviewing  12 Nov · Interview Thu
   Acme · Remote · $120–140k
G  React Engineer                 ◔ 71%   ● Applied       3 Nov · 11 days, no reply  [Follow up]
S  Full-stack Developer           ◔ 91%   ● Saved         Not yet                    [Mark applied]
```

Clicking a row opens a side panel (a Sheet below the `lg` breakpoint):

- Header: role, company, "Open posting ↗".
- **Status:** four steps (Saved, Applied, Interviewing, Offer) to click, a separate "Not accepted" button, and the dated history beneath, newest first. Moving to Interviewing asks for an optional next-step date and note (e.g. "Interview, Thu 19 Nov 10:00").
- **Match · 82% (AI estimate):** one or two sentences, chips for skills the owner has, dashed chips for skills they are missing, and a "Recheck" button.
- **Details:** location, work mode, salary, employment type, posted date. Editable.
- **Job description:** collapsed to a few lines with "Show all". Editable.
- **Notes:** free text, autosaves.
- **Tailor my CV:** disabled, "Coming next".
- A menu with Delete (Undo toast).

On narrow screens the table becomes stacked rows (role and company, then status pill and the waiting line) and the stat tiles go two by two.

Colours follow the app's rules: monochrome, with the `status-*` accents for status dots (Saved `status-todo`, Applied `status-progress`, Interviewing `status-hold`, Offer `status-done`, Not accepted `muted-foreground`) and `signal` for the match ring and the "no reply" nudge. Company logos are the company's initial on a `muted` square; the tinted squares in the mockup are dropped to keep the app monochrome. **(my call)**

## Statuses and the trail

- Status is one of `saved`, `applied`, `interviewing`, `offer`, `rejected` (shown as "Not accepted").
- The current status is stored on the job; each change also adds an event `{ kind: 'status', status, day }`. "Applied" in the table is the day of the first `applied` event. Moving back (for example Offer back to Interviewing) is allowed and is just another event.
- Follow-up adds an event `{ kind: 'followUp', day }`.
- Days are the owner's local date from the browser (`useToday`), like the rest of the app. A status change can be back-dated in the panel (date input defaulting to today, never after today). **(my call)**
- A job has an optional next step: `nextStepDay` and `nextStepNote` (up to 120 characters). It is shown in the Applied column ("Interview Thu") and feeds the Interviewing tile. It clears itself from view once the day has passed; the stored value stays until edited.

### Waiting and the nudge **(my call)**

- A job is waiting when its status is `applied`. It has waited for the days since its latest `applied` or `followUp` event.
- At 7 days or more the row shows "N days, no reply" in `signal` with a Follow up button. Following up resets the count.
- Nothing changes the status. After 30 days the line reads "N days, no reply · close it?" and the button menu offers "Mark not accepted".

### The tiles

All computed in the browser from the full job list.

- **Applied this week:** jobs whose first `applied` event falls in the last 7 days; detail line is the last 30 days.
- **Waiting on a reply:** jobs in `applied`; detail line counts those waiting 14 days or more.
- **Interviewing:** jobs in `interviewing`; detail line names the soonest next step on or after today.
- **Reply rate:** of jobs that were ever applied, the share that later reached `interviewing`, `offer` or `rejected`. A thin bar shows the split. A dash when nothing has been applied.

## Adding a job

### From a link

1. The owner pastes a link and presses Add job. Only `http` and `https` links are accepted in the box.
2. The table shows a client-side placeholder row, "Reading the posting…", with a Skullet skeleton. Nothing is stored yet.
3. The browser calls `POST /jobs/ai/read-posting { spaceId, url }`. The server fetches the page, reduces it to text, and asks Gemini for the fields. It returns the fields, or an error saying why it could not read the page.
4. On success the browser creates the job (status `saved`, link kept) through the normal create route, optimistically, and the placeholder becomes the real row. If the owner has a CV saved, the browser then calls the match route for that job.
5. On failure the placeholder goes away and the manual form opens with the link filled in and a "Paste the job description" box, with the reason above it ("This site needs a login to view the posting" or "Couldn't read that page").

### Fetching the page **(my call)**

The server, not Gemini's own browsing, fetches the page, so it can refuse unsafe addresses and tell a login wall from a real posting.

- `http`/`https` only; DNS is resolved first and loopback, private, link-local and other non-public addresses are refused, on every redirect hop too (at most 3 redirects).
- 10 second timeout, 2 MB cap, `text/html` or `text/plain` only, no cookies sent.
- Scripts, styles and tags are stripped to plain text, capped at 30,000 characters, before it goes to Gemini. JSON-LD `JobPosting` data in the page, when present, is passed along too since it is the most reliable source.
- A page that redirects to a sign-in URL, or whose text Gemini judges is not a job posting, returns the login or not-a-posting error.

Sites such as LinkedIn and Indeed usually need a login, so the paste fallback is a normal path, not an edge case.

### By hand

A dialog with role (required), company (required), link, location, work mode, salary, employment type, posted date, description and status (default Saved). Choosing a status other than Saved records the trail up to it on the chosen day; for example picking Interviewing records Applied and Interviewing on that day. **(my call)**

## Match

- The owner pastes their CV (plain text, up to 20,000 characters) once, in a "Your CV" dialog opened from a button beside Add manually; the button reads "Add your CV" until one is saved. The CV tailoring project will reuse it. **(my call)**
- In the space list and context menu, the space's summary reads "jobs and your CV". **(my call)**
- `POST /jobs/:id/match` sends Gemini the CV and that one job's role, company and description, and stores the reply on the job: `matchPct` (0 to 100), `matchSummary` (up to 300 characters), `skillsHave` and `skillsMissing` (up to 12 each, up to 40 characters each), `matchedAt`.
- Matching runs once when a job is added (if a CV is saved), and again only when the owner presses Recheck. Changing the CV does not re-match every job; the panel shows "CV changed since this match" when `matchedAt` is older than the CV's `updatedAt`. **(my call)**
- With no CV saved, the Match column shows "Add your CV", which opens the same dialog.

## AI rules

- Both AI calls go through `BudgetAiService` like the other features (`readPosting`, `matchJob`), off unless `GEMINI_API_KEY` is set, and every reply is checked against a zod schema before use (`BadGatewayException` when it does not fit).
- `readPosting` is sent only the page text and JSON-LD of that one posting. `matchJob` is sent only the CV and that one job's role, company and description. Notes, statuses and other jobs are never sent.
- With AI off, the link box and the Match column are hidden and Add manually is the way in. The response from `GET /jobs` carries `aiEnabled`, like Fitness.
- The read-posting and match routes assert the space and the lock.

## Data

All rows carry `spaceId` and `userId`; every query is scoped to the user.

- `space_tool` enum gains `jobs`. The space label is "Job hunt" and its icon `BriefcaseBusiness`.
- `job_profiles`: `spaceId` (primary key, cascades with the space), `userId`, `cvText` (text, nullable), `cvUpdatedAt`.
- `jobs`: `id` (client-generated uuid), `spaceId`, `userId`, `role`, `company`, `url` (nullable), `location`, `workMode` (`remote` / `hybrid` / `onsite` / null), `salary` (free text, up to 80 characters; salaries come in too many shapes to parse), `employmentType` (free text, up to 40), `postedOn` (date, nullable), `description` (text, up to 30,000), `notes` (text, up to 5,000), `status`, `events` (jsonb array, checked by zod, oldest first, up to 200), `nextStepDay`, `nextStepNote`, the match fields above, `createdAt`, `updatedAt`. Index on `spaceId`.
- Events live as one JSON array on the job because they are always read and written with it. **(my call)**
- Jobs are hard-deleted. Delete offers Undo by re-creating the job with the same id and its events, as Budget entries do. The space itself still goes to Trash.

## API

Under `/jobs`, all with `AuthGuard`, `@UserId()` and `parseOrThrow`. As elsewhere in the app, the routes that return the space's contents (`GET /jobs` and both AI routes) call `assertUnlocked`; writes are scoped to the owner.

- `GET /jobs?spaceId=` returns `{ profile, jobs, aiEnabled }`.
- `PUT /jobs/profile` saves the CV.
- `POST /jobs` creates a job (also used by Undo); `PATCH /jobs/:id` updates fields, status, events, next step and notes; `DELETE /jobs/:id`.
- `POST /jobs/ai/read-posting` and `POST /jobs/:id/match` as above. The read route gets no larger body limit; it only takes a URL.

## Web

- Route `/jobs?space=` with `JobsPageComponent`; `page.tsx` only renders it.
- One query, `['jobs', spaceId]`, holding the profile and all jobs. Mutations are optimistic and patch that object, restoring it and showing a toast on error, as Budget does.
- Waiting days, the tiles, tab counts, search (role and company, case-insensitive) and sorting (default: most recent event first; column headers sort by Applied and Match) are computed in the browser in a `jobs-math.ts` with tests.
- Skullet everywhere with `sample-jobs.ts` for the skeleton.
- Notes autosave after a short pause; other fields save on blur or explicit Save.

## Left to the builder

- Exact Gemini prompts, within the rules above.
- How the HTML is reduced to text, as long as scripts and styles never reach Gemini.
- Component boundaries and file names, within the project's naming rules.
- Wording of empty states, within the voice of the rest of the app.
