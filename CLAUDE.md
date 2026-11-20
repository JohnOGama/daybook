# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Daybook is a personal workspace: a Next.js app (`apps/web`) and a NestJS API (`apps/api`) in a pnpm workspace, using Postgres (Neon), Drizzle and Better Auth. Everything lives in spaces, each running one tool: List (day-based tasks, Calendar, Kanban), Notebook, Book, Vault, Budget, Fitness, Job hunt, Database diagram, Pipelines, Skills and Uptime. There is also an Assistant page, and spaces can be shared and edited live. `docs/superpowers/specs/2026-11-09-daybook-design.md` has the overview and the task list's design, and each tool or feature has its own spec in the same folder. The rule sections below are the working summary of how each one behaves.

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

## Rules by area

The rules live in one file per area, imported below. Keep each file current: a behaviour change in a feature updates its file.

- How the system fits together: Next.js, the request path and auth, and API conventions. @docs/claude/architecture.md
- Task rules: The List tool: days, carry-over, subtasks. @docs/claude/tasks.md
- Page history: Notebook and Book page versions. @docs/claude/notebook.md
- Budget rules: Money, totals, transfers, schedules, currencies, the budget AI. @docs/claude/budget.md
- Fitness rules: Units, built-in foods and exercises, plans, targets. @docs/claude/fitness.md
- Job hunt rules: Statuses, posting fetches, CV matching. @docs/claude/jobs.md
- Database diagram rules: DBML, layout, AI edits, live editing. @docs/claude/diagram.md
- Live presence: The realtime WebSockets, rooms and presence. @docs/claude/realtime.md
- Pipelines rules: The Jenkins report endpoint, keys, pushes, the AI helper. @docs/claude/pipelines.md
- Skills rules: SKILL.md pages, the improve AI, download. @docs/claude/skills.md
- Uptime rules: Checks, the scheduler, incidents, the live dot. @docs/claude/uptime.md
- Assistant page: The /assistant page and its dots. @docs/claude/assistant.md
- Sharing rules: Shares, access checks, versions. @docs/claude/sharing.md
- Web data flow, UI and loading: Query keys, the Vault cache rule, optimistic mutations, theme, Skullet. @docs/claude/web.md
- Code conventions: Folder layout, naming, components, pages, React Query, style, shadcn/ui. @docs/claude/conventions.md

---

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
