# Daybook

A personal, day-based task manager. Next.js web app and NestJS API in a pnpm workspace.

## Set up

Needs Node 22 and pnpm.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

Fill in `apps/api/.env`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | A long random string, such as the output of `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | The web app's address, `http://localhost:3000` locally |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Sender address, such as `Daybook <codes@yourdomain.com>` |
| `PORT` | API port, `4000` by default |

Resend only delivers to other people once your sending domain is verified. Until then, `onboarding@resend.dev` can send only to your own Resend account's email.

If the API runs anywhere other than `http://localhost:4000`, set `API_ORIGIN` for the web app.

Create the tables:

```bash
pnpm run db:migrate
```

## Run

This starts the API and web app together:

```bash
pnpm run dev
```

Open http://localhost:3000.

## Before deploying

Sign-in and code requests are not rate limited yet. Better Auth only enables its limiter when `NODE_ENV=production`, and behind the Next.js rewrite it can't see the visitor's IP, so everyone would share one limit. Before the app is public, have your host or proxy set a trusted client IP header, then set `rateLimit: { enabled: true }` and `advanced.ipAddress` in `apps/api/src/features/auth/src/create-auth.ts`.

The Vault only works over HTTPS or on localhost, because browsers limit Web Crypto to secure connections. Serve the app over HTTPS and add a Content-Security-Policy so injected scripts can't read an unlocked vault.

## Test

```bash
pnpm -r exec vitest run
```

The API tests use an in-memory database and need no credentials.
