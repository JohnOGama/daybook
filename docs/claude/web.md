# Web data flow, UI and loading

## Web data flow

- The active space comes from the `?space=` param through `useActiveSpace`. Task queries are keyed `['tasks', spaceId, from, to, today]`; the other roots are `['spaces']`, `['space-groups']` (the sidebar's groups, like "Spaces" and "Work"), `['trash']`, `['pages', spaceId]` (Notebook pages and Book chapters, which autosave through `usePageAutosave` instead of rolling back), `['page-versions', pageId]` (a page's history, read only while its panel is open), `['vault']`, `['vault-items', spaceId]`, `['budget', spaceId]` (a Budget's accounts, categories and entries in one object), `['fitness', spaceId]` (profile, weigh-ins, meal plans and workout templates), `['fitness-days', spaceId, from, to]` (food logs and workouts for a range of days), `['fitness-foods', spaceId, …]` (food search, recent and own foods), `['fitness-exercises', spaceId]`, `['jobs', spaceId]` (the CV and every job in one object), `['diagram', spaceId]` (whether the diagram AI is on; the text and positions come from the live document), `['space-lock', spaceId]` (whether a locked space is unlocked in this browser), `['space-shares', spaceId]` (who a space is shared with, read only while the Share dialog is open), `['pipelines', spaceId]` (each job's newest run with its expected stages, plus the 30 newest runs), `['pipeline-run', runId]` (one run for the drawer, read only while it is open) and `['pipeline-key', spaceId]` (when the key was made and last used, owner only).
- The Vault encrypts in the browser (`features/vault/src/vault-crypto.ts`). Its query cache holds ciphertext only. The key and decrypted items stay in component state, never in the cache, storage, the URL, toasts or logs.
- Mutations are optimistic: the client generates IDs with `crypto.randomUUID()`, patches the cache, and on error restores the snapshot and shows a toast. A successful change does not refetch.
- Task mutations are created once by `TaskMutationsProviderComponent`; rows read them with `useTaskMutations`, and memoised rows rely on `task-cache.ts` keeping unchanged tasks the same object.
- Because of that, server rules are mirrored in `features/tasks/src/task-cache.ts` and `features/spaces/src/space-cache.ts`. A behaviour change in a service usually needs the matching cache change.

## UI

shadcn/ui (new-york style) on Radix with Tailwind CSS v4, with generated components in `apps/web/src/shared/components/ui`. Also `lucide-react` icons, `sonner` toasts and `@dnd-kit` for reordering.

The app is dark only and monochrome. Use the theme tokens in `globals.css` rather than Tailwind palette classes, and keep colour for `destructive` (errors and delete actions), the dark yellow `signal` accent (high priority and progress), the `status-*` accents (task status, and job status in Job hunt) and `money-in` / `money-out` (signed amounts in Budget, through `moneyTone`). The one other exception is brand logos (`features/budget/src/brand-icons.ts`), which keep their brand colours; their shapes come from Simple Icons (CC0), a few presets use logo images saved in `apps/web/public/brands`, and the rest are brand-coloured initials. Floating surfaces get their translucent border and shadow from the `data-slot` rules in `globals.css`.

## Skeleton loading

Use Skullet (`skullet/react`) for every loading state, with no spinners, "Loading…" text or blank screens. Disabled submit buttons during a form action are not loading states.

- **Data views:** render the real component from sample data inside `<Skeleton loading={isPending} label="…">`, so the skeleton matches the final layout. See `ListPageComponent` and `sample-tasks.ts`.
- **Before any content exists** (session checks, Suspense fallbacks): use the `SkeletonBox` layouts `AppSkeletonComponent`, `PageSkeletonComponent` or `AuthCardSkeletonComponent`.
- **Tests:** sample text stays in the DOM but hidden, so query by role rather than text.
- **Large live views:** Skullet keeps measuring the content inside `<Skeleton>` after loading; for big, constantly changing views (the database diagram) render the loaded content outside it.
- **Debugging:** add `?skullet-debug` to a URL to outline each skeleton and show layout shifts.
- **The `id` prop:** it remembers shapes across visits. If you start using it, call `forgetShapes()` on sign-out.
