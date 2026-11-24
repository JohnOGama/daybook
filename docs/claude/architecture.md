# How the system fits together

## Next.js

`apps/web` uses a Next.js version with breaking changes from common knowledge. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing Next.js code.

## Request path and auth

- The browser only calls same-origin `/api/*`. `next.config.ts` rewrites that to the API (`API_ORIGIN`, default `http://localhost:4000`), which keeps session cookies first-party.
- `apps/api/src/main.ts` mounts Better Auth directly on Express at `/api/auth/*splat` with Nest's body parser off, then adds `express.json()`. Better Auth needs the unparsed body, so keep that order.
- `/.well-known/*` is rewritten to the API too (OAuth and MCP discovery). `POST /api/mcp` takes a bearer token from Daybook's OAuth provider instead of the session cookie; see `docs/claude/mcp.md`.
- Controllers use `@UseGuards(AuthGuard)` and `@UserId()`, and validate input with `parseOrThrow(zodSchema, body)`. Every service query must be scoped to `userId`.
- A space can have a password (any tool but Vault). `SpaceLockService` enforces it on the server: any endpoint that returns a space's contents must call `assertUnlocked` (or mask them, as Trash does), and unlocking sets a signed, httpOnly `daybook_unlock_<spaceId>` cookie. The web `SpaceLockGateComponent` only decides what to show.
- The web app's sign-in gate is client-side, in `AppShellComponent`. Auth rate limiting is off until the steps in the README's "Before deploying" section are done.

## API conventions

- The API runs two background jobs in its own process, the uptime scheduler (`UptimeScheduler`) and interview reminders (`InterviewReminderScheduler`), and keeps live rooms in memory, so it must run as a single instance.
- The API runs through `tsx`, with no `emitDecoratorMetadata`, so every constructor dependency needs an explicit `@Inject(Token)`.
- Relative imports in `apps/api` include the `.ts` extension. `apps/web` uses the `@/` alias.
