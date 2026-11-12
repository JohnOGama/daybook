# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daybook is a personal, day-based task manager: a Next.js app (`apps/web`) and a NestJS API (`apps/api`) in a pnpm workspace, using Postgres (Neon), Drizzle and Better Auth. Intended product behaviour is specified in `docs/superpowers/specs/2026-11-09-daybook-design.md`.

The structure and naming rules below apply inside each app, so `src/features` means `apps/web/src/features` or `apps/api/src/features`.

---

## Commands

Needs Node 22 and pnpm. Copy `apps/api/.env.example` to `apps/api/.env` and fill it in before running the API or migrating.

```bash
pnpm run dev                 # API on :4000 and web on :3000
pnpm run db:migrate          # apply migrations
pnpm --filter api db:generate  # create a migration after editing the schema

pnpm -r exec vitest run      # all tests
pnpm --filter api exec vitest run src/features/tasks/src/tasks-service.test.ts
pnpm --filter web exec vitest run src/features/spaces/src/space-tree.test.ts -t "test name"

pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api build
pnpm --filter web build
```

No linter or formatter is configured. API tests run the real migrations in `apps/api/drizzle` against in-memory PGlite (`createTestDb`) and need no credentials, so a schema change needs `db:generate` before those tests will see it.

---

## How the System Fits Together

### Next.js

`apps/web` uses a Next.js version with breaking changes from common knowledge. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing Next.js code.

### Request path and auth

- The browser only calls same-origin `/api/*`. `next.config.ts` rewrites that to the API (`API_ORIGIN`, default `http://localhost:4000`), which keeps session cookies first-party.
- `apps/api/src/main.ts` mounts Better Auth directly on Express at `/api/auth/*splat` with Nest's body parser off, then adds `express.json()`. Better Auth needs the unparsed body, so keep that order.
- Controllers use `@UseGuards(AuthGuard)` and `@UserId()`, and validate input with `parseOrThrow(zodSchema, body)`. Every service query must be scoped to `userId`.
- A space can have a password (any tool but Vault). `SpaceLockService` enforces it on the server: any endpoint that returns a space's contents must call `assertUnlocked` (or mask them, as Trash does), and unlocking sets a signed, httpOnly `daybook_unlock_<spaceId>` cookie. The web `SpaceLockGateComponent` only decides what to show.
- The web app's sign-in gate is client-side, in `AppShellComponent`. Auth rate limiting is off until the steps in the README's "Before deploying" section are done.

### API conventions

- The API runs through `tsx`, with no `emitDecoratorMetadata`, so every constructor dependency needs an explicit `@Inject(Token)`.
- Relative imports in `apps/api` include the `.ts` extension. `apps/web` uses the `@/` alias.

### Task rules

- A task's visible day is computed on read by `appearsOn` in `task-rules.ts`, with no nightly job: finished tasks show on `completedOn`, unfinished future tasks on `plannedDay`, and overdue tasks on today, or on `plannedDay` when the space has `carryOver` off.
- "Today" is the user's local date, sent by the browser (`useToday`) on each relevant request. Don't use the server's clock for it.
- Subtasks nest to any depth and appear with their top-level task. Only top-level tasks have `plannedDay`, enforced by a DB check. Finishing or reopening walks the whole tree: down through descendants and up through ancestors.
- Changes that affect a parent and its subtasks run in one transaction using `lockFamily`, so auto-tick and reopen can't half-apply.
- Tasks and spaces are soft-deleted with `deletedAt`, so queries must filter on `isNull(deletedAt)`. Deleting a parent task marks only the parent; its subtasks are hidden because they load through it. `TrashService` restores missing parents, spaces and folders.

### Budget rules

- Money is whole cents in `bigint` columns (`mode: 'number'`), never floats. The web parses and formats it with `budget-money.ts`.
- Totals are computed in the browser by `features/budget/src/budget-math.ts` from the full entry list; the API only stores and checks ownership. Entries dated after today (`useToday`) are planned: they never change a balance or a month total.
- Transfers move money between two accounts and are never income or spending. Deleting an account deletes its entries; deleting a category leaves its entries uncategorised.
- Budget rows are hard-deleted (the space itself still goes to Trash), so entry delete offers Undo by re-creating the entry with the same id.
- Recurring schedules (`budget_schedules`) never move money themselves. An occurrence counts only once it is recorded as an entry linked by `scheduleId` and `occurrenceDay`, and a unique index on that pair stops it being recorded twice (the API answers 409). Occurrence dates are worked out in the browser by `schedule-math.ts`; there is no server job, so schedules set to record automatically are caught up by `BudgetPageComponent` whenever the budget is open.
- Each account can have its own currency (`null` means the budget's). Anything that adds amounts across accounts must go through `budget-currency.ts` (`baseEntries`, `totalInBase`, `toBase`), which converts with the hand-set `rates` on the budget; a transfer between currencies stores what arrived as `toAmount`. Per-account figures are shown in the account's own currency.
- Goal contributions only track progress towards a goal; they never move money between accounts. Credit cards and loans are accounts whose balance runs below zero, with optional interest, due day and minimum payment.
- The AI features (receipt scanning, category suggestions, the monthly check-in) call Gemini through `@google/genai` in `BudgetAiService`, and are off unless `GEMINI_API_KEY` is set (`GEMINI_MODEL` overrides the model). Only the note and amount being categorised, the receipt photo, or the month's summary figures are sent, never notes or account names in bulk, and every reply is checked against a zod schema before use. Category suggestions try the user's own past entries first and only ask Gemini when nothing matches.
- Receipt photos are shrunk in the browser (`receipt-image.ts`) and stored as base64 in `budget_receipts`, one per entry; the receipt and scan routes get an 8 MB body limit in `main.ts`.
- Changes made offline wait in React Query's paused-mutation queue and go out when the browser is back online; `useOfflineQueue` shows that state and warns before closing the tab. The queue lives in the tab only.

### Web data flow

- The active space comes from the `?space=` param through `useActiveSpace`. Task queries are keyed `['tasks', spaceId, from, to, today]`; the other roots are `['spaces']`, `['trash']`, `['pages', spaceId]` (Notebook pages and Book chapters, which autosave through `usePageAutosave` instead of rolling back), `['vault']`, `['vault-items', spaceId]`, `['budget', spaceId]` (a Budget's accounts, categories and entries in one object) and `['space-lock', spaceId]` (whether a locked space is unlocked in this browser).
- The Vault encrypts in the browser (`features/vault/src/vault-crypto.ts`). Its query cache holds ciphertext only. The key and decrypted items stay in component state, never in the cache, storage, the URL, toasts or logs.
- Mutations are optimistic: the client generates IDs with `crypto.randomUUID()`, patches the cache, and on error restores the snapshot and shows a toast. A successful change does not refetch.
- Task mutations are created once by `TaskMutationsProviderComponent`; rows read them with `useTaskMutations`, and memoised rows rely on `task-cache.ts` keeping unchanged tasks the same object.
- Because of that, server rules are mirrored in `features/tasks/src/task-cache.ts` and `features/spaces/src/space-cache.ts`. A behaviour change in a service usually needs the matching cache change.

### UI

shadcn/ui (new-york style) on Radix with Tailwind CSS v4, with generated components in `apps/web/src/shared/components/ui`. Also `lucide-react` icons, `sonner` toasts and `@dnd-kit` for reordering.

The app is dark only and monochrome. Use the theme tokens in `globals.css` rather than Tailwind palette classes, and keep colour for `destructive` (errors and delete actions), the dark yellow `signal` accent (high priority and progress), the `status-*` accents (task status) and `money-in` / `money-out` (signed amounts in Budget, through `moneyTone`). The one other exception is brand logos (`features/budget/src/brand-icons.ts`), which keep their brand colours; their shapes come from Simple Icons (CC0), a few presets use logo images saved in `apps/web/public/brands`, and the rest are brand-coloured initials. Floating surfaces get their translucent border and shadow from the `data-slot` rules in `globals.css`.

### Skeleton loading

Use Skullet (`skullet/react`) for every loading state, with no spinners, "Loading…" text or blank screens. Disabled submit buttons during a form action are not loading states.

- **Data views:** render the real component from sample data inside `<Skeleton loading={isPending} label="…">`, so the skeleton matches the final layout. See `ListPageComponent` and `sample-tasks.ts`.
- **Before any content exists** (session checks, Suspense fallbacks): use the `SkeletonBox` layouts `AppSkeletonComponent`, `PageSkeletonComponent` or `AuthCardSkeletonComponent`.
- **Tests:** sample text stays in the DOM but hidden, so query by role rather than text.
- **Debugging:** add `?skullet-debug` to a URL to outline each skeleton and show layout shifts.
- **The `id` prop:** it remembers shapes across visits. If you start using it, call `forgetShapes()` on sign-out.

---

## Architecture

- Every root module must contain:
  - `src/` – implementation files
  - `index.ts` – barrel exports
- Keep files grouped by feature whenever possible.
- Place shared code inside `src/shared`.

Example:

```
src/
├── features/
│   └── users/
│       ├── src/
│       └── index.ts
│
└── shared/
    ├── utils/
    ├── hooks/
    ├── services/
    └── components/
```

---

## Naming Conventions

### Components

- Use **PascalCase**.
- Component filenames should end with `Component`.

Example:

```
UserTableComponent.tsx
DashboardComponent.tsx
```

### Hooks

- Use **camelCase**.
- Prefix every hook with `use`.

Example:

```
useAuth.ts
usePagination.ts
useUsers.ts
```

### Utilities, Helpers & Services Or Js functions

- Use **kebab-case**.

Example:

```
date-formatter.ts
calculate-total.ts
auth-service.ts
```

Store them under:

```
src/shared/utils
src/shared/helpers
src/shared/services
```

---

## Component Guidelines

- Keep components focused on a single responsibility.
- Split a component into smaller components only when:
  - it becomes too large,
  - the UI is reusable,
  - or it improves readability.
- Avoid creating unnecessary wrapper components.

---

## Page Structure

- **Do not place the main implementation inside `page.tsx`.**
- `page.tsx` should only compose and render the page component.

Example:

```
page.tsx
    ↓
UsersPageComponent.tsx
```

This keeps routing files clean and makes components easier to test and reuse.

---

## React Query

- Use **React Query** for all server state.
- Keep hooks close to the feature they belong to.

Example:

```
src/features/users/hooks/useUsers.ts
src/features/dashboard/hooks/useDashboard.ts
```

Only place hooks inside `src/shared/hooks` if they are reusable across multiple features.

---

## Code Style

- Write self-explanatory code before relying on comments.
- Keep comments minimal and only add them when they provide context that isn't obvious from the code.
- Prefer descriptive variable and function names over excessive comments.
- Keep functions and components small and easy to understand.
- Follow consistent formatting throughout the project.

## UI Components

### shadcn/ui

- Use **shadcn/ui** as the default UI component library throughout the application.
- Reuse existing shadcn/ui components whenever possible before creating custom components.
- Customize shadcn/ui components through composition and styling instead of modifying their source unless necessary.
- Keep feature-specific UI components within their respective feature folders.
- Place reusable UI components under `src/shared/components`.
- Maintain consistent styling, spacing, and behavior across the application by following the established shadcn/ui patterns.
- Ensure all custom components are compatible with the project's design system and theme.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
