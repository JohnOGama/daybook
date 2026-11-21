# MCP server (Fitness first) design

## Why

The owner wants to log food and workouts by talking to ChatGPT, Claude or Gemini ("log 2 eggs and toast for breakfast", "log push day"), without opening Daybook. Daybook becomes a remote MCP server those apps connect to. Fitness is first; other tools follow later on the same base.

## Goals

- Adding Daybook in ChatGPT or Claude (web, desktop, phone) or Gemini CLI works by URL alone: the app registers itself, a Daybook sign-in opens, the owner approves on a consent page, and the app can then call Daybook's tools on the owner's behalf.
- Tools (all take an explicit `day` as `YYYY-MM-DD`, the user's local date, which the assistant fills in; Daybook never guesses "today"):
  - `list_fitness_spaces`: the Fitness spaces the person can edit (id, title). The other tools take an optional `spaceId`; it may be left out only when there is exactly one, otherwise they answer with the list and ask the assistant to choose.
  - `search_foods(query)`: built-in (USDA) and the space's own foods, each with nutrition per 100 g and its servings.
  - `log_food(day, meal, items[])`: each item either names a food from `search_foods` (by id) with grams or a number of one of its servings, and Daybook works out the calories and macros; or is a one-off food with a name and the assistant's own estimate of kcal, protein, carbs, fat and fiber for the amount eaten. Logged as eaten.
  - `search_exercises(query)`: built-in and the space's own exercises (id, name, kind, muscles).
  - `log_workout(day, name, exercises[])`: each exercise names one from `search_exercises` (by id) or gives a name; each set has reps, weight in kg, seconds or meters as fits. Saved as a workout whose sets are done.
  - `get_day(day)`: that day's food logs by meal with ids and totals (kcal, protein, carbs, fat, fiber), and its workouts with ids.
  - `remove_food_log(logId)` and `remove_workout(workoutId)`: undo mistakes.
  - `log_weight(day, kg)`: the day's weigh-in.
- Units at the tool boundary are what people say (grams, servings, kg, seconds, meters); Daybook converts to what it stores (mg, thousandths of a serving, grams, …), with the same limits as the app's own routes.
- **Settings → Connected apps** lists the apps the owner has approved, with when, and a Disconnect that revokes their access.

## Non-goals

- Calorie and macro targets, "how much have I got left", forecasts and BMI: they are computed in the browser today (`targets-math.ts`); moving them to the server is a follow-up.
- Other tools (tasks, budget, notebook…), editing logs or workouts in place, meal plans, templates, custom foods or exercises created through MCP.
- A personal-key alternative for CLI-only use; OAuth covers Gemini CLI too.
- Anyone but the owner's own Daybook account: an app only acts as the person who approved it.

## Anti-goals

- An app must never do more than the person could in the browser: every tool goes through `SpaceAccessService` (edit access, Vault never), and logs land under the space owner, as in the app.
- A food the assistant invents must never be stored as a reusable food: one-off items are logs only (`foodId: null`).
- A wrong guess at the day: tools refuse a missing or malformed `day` rather than defaulting.
- Tokens must not outlive Disconnect.

## Constraints

- ChatGPT and Claude connect from their own servers, so Daybook must be reachable at a public HTTPS address: the production site behind Cloudflare, or a temporary tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) while developing. `localhost` works only for local clients (MCP Inspector, Claude Code, Gemini CLI).
- The API runs as one instance and already proxies through Next; nothing here changes that.

## Approaches

1. **Better Auth's OAuth provider plugin and the official MCP SDK inside the API (picked).** `@better-auth/oauth-provider@1.7.18` matches the installed `better-auth` 1.7.18, reuses Daybook's accounts and sessions, and provides dynamic client registration, PKCE, consent and the discovery metadata that ChatGPT and Claude require. `@modelcontextprotocol/sdk` serves the tools from the Nest API, which calls the existing Fitness services.
2. **A hand-written OAuth server.** Rejected: security-critical and easy to get subtly wrong.
3. **A hosted identity provider (Auth0, WorkOS).** Rejected: a new vendor and account linking for a personal app.
4. **A personal access key.** Rejected by the owner: ChatGPT and claude.ai only accept OAuth or no auth, so the key would have to live in the URL.

## How (decided)

- **OAuth.** Add the Better Auth `jwt` plugin (the provider's recommended mode: JWT access tokens checked against Daybook's JWKS) and `oauthProvider` with:
  - `loginPage: '/sign-in'` and `consentPage: '/oauth/consent'`;
  - dynamic client registration allowed, including unauthenticated (public) clients;
  - PKCE required;
  - scopes `openid`, `profile`, `offline_access` and `fitness`;
  - the MCP endpoint's URL as the valid audience.
- **Migration.** The plugins' tables come in through a Drizzle migration generated from `auth-schema.ts` (via the Better Auth CLI's schema output).
- **Sign-in continues the request.** When `/sign-in` was reached from an authorization request, signing in (password or email code) must continue that request instead of going to the app.
- **Consent page** (`/oauth/consent`, web): it names the app, says "wants to log food, workouts and weight in your Fitness spaces", and has Allow and Deny. It is shown once per app and scope set.
- **Discovery.** The authorization-server metadata (`/.well-known/oauth-authorization-server`, plus `openid-configuration`) and the MCP protected-resource metadata (`/.well-known/oauth-protected-resource` and its `/api/mcp` path form) are served at the site root.
  - Next's rewrites and the production nginx config forward `/.well-known/*` to the API.
  - Everything public is on the web origin (`BETTER_AUTH_URL`); the API stays behind it.
- **The MCP endpoint** is `POST /api/mcp`: Streamable HTTP, stateless, answering in JSON, so nothing streams through the Next proxy.
  - A missing or invalid bearer token answers 401 with `WWW-Authenticate` pointing at the resource metadata, which is how clients find out where to sign in.
  - A valid token (signature, issuer, audience, expiry, the `fitness` scope, and the consent not revoked) gives the user id the tools act as.
  - It is mounted in `main.ts` next to Better Auth, before Nest's JSON body parser concerns, with its own small body limit (1 MB).
- **Tools** live in an API feature (`features/mcp`) and call the existing services:
  - `FitnessFoodService` for search, logs and removals;
  - `FitnessWorkoutService` for exercise search, workouts and removals;
  - `FitnessService` for weigh-ins;
  - `SpaceAccessService.resolve(…, 'edit')` for every space.
  - Inputs are checked with zod; tool errors come back as MCP tool errors in plain sentences ("That food isn't in this space", "Ask which Fitness space: …").
  - Nutrition for a food by id is worked out on the server from its per-100 g numbers, the same way the web's `food-math.ts` does: grams × per-100 g, rounded to whole units.
- **Locked spaces.** MCP requests carry no unlock cookie, so a password-locked Fitness space is not reachable over MCP. `list_fitness_spaces` leaves it out (or says it is locked), and the other tools refuse it.
- **Connected apps** (Settings, a third tab next to Spaces and Security) lists consents through the plugin's consent API, with Disconnect deleting the consent and its tokens.
- **Docs:** `docs/claude/mcp.md` with the working rules, linked from `CLAUDE.md`; the README's "Before deploying" gains the nginx `/.well-known` step.

## Small calls made in writing this (the owner can change any)

- Shared Fitness spaces the person can edit are included; view-only ones are not listed.
- Password-locked Fitness spaces are out of reach over MCP (there is no unlock cookie), rather than adding a way to send the password through chat.
- Access tokens last 1 hour, refresh tokens 30 days (the provider's knobs), so a connected app stays connected without signing in again.
- `get_day` returns at most one day; ranges are left out.
- A workout's exercise named without an id is saved with its name only, no muscles, like a one-off.

## Left to the builder

- The exact Better Auth CLI or hand-written Drizzle definitions for the plugin tables, kept in `auth-schema.ts` the way the existing auth tables are.
- How sign-in learns it is mid-authorization (the provider's signed query parameters or its client helper) and how it continues.
- Whether the MCP endpoint is a Nest controller or a raw Express handler in `main.ts`, as long as the body and auth rules above hold.
- Wording of tool descriptions (they steer the assistant: say "the user's local date", "search first, then log by id", "log one-off foods with your own estimate only when nothing matches").
- Testing against a real client at the end (MCP Inspector, then Claude or ChatGPT).
