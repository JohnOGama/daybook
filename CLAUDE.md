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
- The web app's sign-in gate is client-side, in `AppShellComponent`. Auth rate limiting is off until the steps in the README's "Before deploying" section are done.

### API conventions

- The API runs through `tsx`, with no `emitDecoratorMetadata`, so every constructor dependency needs an explicit `@Inject(Token)`.
- Relative imports in `apps/api` include the `.ts` extension. `apps/web` uses the `@/` alias.

### Task rules

- A task's visible day is computed on read by `appearsOn` in `task-rules.ts`, with no nightly job: finished tasks show on `completedOn`, unfinished future tasks on `plannedDay`, and overdue tasks on today.
- "Today" is the user's local date, sent by the browser (`useToday`) on each relevant request. Don't use the server's clock for it.
- Subtasks are one level deep and appear with their parent. Only top-level tasks have `plannedDay`, enforced by a DB check.
- Changes that affect a parent and its subtasks run in one transaction using `lockFamily`, so auto-tick and reopen can't half-apply.
- Tasks and spaces are soft-deleted with `deletedAt`, so queries must filter on `isNull(deletedAt)`. Deleting a parent task marks only the parent; its subtasks are hidden because they load through it. `TrashService` restores missing parents, spaces and folders.

### Web data flow

- The active space comes from the `?space=` param through `useActiveSpace`. Task queries are keyed `['tasks', spaceId, from, to, today]`; the other roots are `['spaces']`, `['trash']` and `['pages', spaceId]` (Notebook pages, which autosave through `usePageAutosave` instead of rolling back).
- Mutations are optimistic: the client generates IDs with `crypto.randomUUID()`, patches the cache, and on error restores the snapshot and shows a toast. A successful change does not refetch.
- Because of that, server rules are mirrored in `features/tasks/src/task-cache.ts` and `features/spaces/src/space-cache.ts`. A behaviour change in a service usually needs the matching cache change.

### UI

shadcn/ui (new-york style) on Radix with Tailwind CSS v4, with generated components in `apps/web/src/shared/components/ui`. Also `lucide-react` icons, `sonner` toasts and `@dnd-kit` for reordering.

The app is dark only and monochrome. Use the theme tokens in `globals.css` rather than Tailwind palette classes, and keep colour for `destructive` (errors and delete actions), the dark yellow `signal` accent (high priority and progress) and the `status-*` accents (task status). Floating surfaces get their translucent border and shadow from the `data-slot` rules in `globals.css`.

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
