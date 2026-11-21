# MCP server (Fitness first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ChatGPT, Claude or Gemini can connect to Daybook by URL, sign in through Daybook's own OAuth, and log food, workouts and weigh-ins in the person's Fitness spaces through nine MCP tools.

**Architecture:** Better Auth gains the `jwt` plugin and `@better-auth/oauth-provider` (dynamic client registration, PKCE, consent, discovery). The API serves `POST /api/mcp` with the official MCP SDK in stateless JSON mode. It checks the bearer JWT locally against Daybook's JWKS and checks that the consent still exists, then runs tools that call the existing Fitness services through `SpaceAccessService`. The web gets a consent page, a sign-in that continues the authorization, and Settings → Connected apps.

**Tech Stack:** NestJS 12 on Express 5, Better Auth 1.7.18, Drizzle and PGlite, `@modelcontextprotocol/sdk`, `jose`, Next.js and React Query.

**Spec:** `docs/superpowers/specs/2026-11-21-mcp-fitness-design.md`

## Global Constraints

- **Dependencies:**
  - API: `@better-auth/oauth-provider@1.7.18` (exactly, to match `better-auth` 1.7.18), `@modelcontextprotocol/sdk@1.32.2` and `jose@6.2.16` (already in the tree through better-auth; declare it).
  - Web: `@better-auth/oauth-provider@1.7.18`.
  - Upgrade nothing else.
- **URLs:**
  - MCP URL: `${BETTER_AUTH_URL}/api/mcp`, built by `mcpUrlFor(baseURL)`.
  - Resource metadata: `${BETTER_AUTH_URL}/.well-known/oauth-protected-resource/api/mcp`.
  - Everything public is on the web origin.
- **OAuth settings:**
  - Scopes: `openid`, `profile`, `offline_access` and `fitness`. Tools need `fitness`.
  - Access tokens last 3600 s and refresh tokens 30 days (2_592_000 s).
  - PKCE is required. Dynamic registration is on, including unauthenticated (public) clients.
- **Space rules for every tool:**
  - Access goes through `SpaceAccessService.resolve(…, 'edit')`, Fitness spaces only, and rows are written under the returned `ownerId`.
  - Locked spaces are refused with: "This space is locked with a password. Open it in Daybook instead."
- **Days:** `day` is required as `YYYY-MM-DD` (the user's local date) and is never defaulted.
- **One-off foods** are logs only (`foodId: null`) and never create `fitness_foods` rows.
- **Nutrition** for a food by id is the web's `itemFor` (`food-math.ts`): `amountMg = round(quantity × serving.amountMg)`, and each value is `round(per100g × amountMg / 100_000)`. Grams use the serving `{ label: 'g', amountMg: 1000 }`.
- **Built items:** every item is checked against `foodItemFields` (and workouts against `workoutSchema`) before saving, so the MCP path keeps the app's limits.
- **API conventions:**
  - An explicit `@Inject(Token)` on every constructor dependency.
  - Relative imports in `apps/api` end in `.ts`.
  - Files written from PowerShell must not get a UTF-8 BOM.
- **Copy:**
  - The consent sentence: "<App> wants to log food, workouts and weight in your Fitness spaces."
  - The Settings tab label: "Connected apps".
- **No commits.** The owner commits. Wherever a step says "Commit", skip it, and end the run with a ready-to-paste commit message.
- **Upkeep:** after code changes, run `graphify update .`

## Review Focus

1. **A client that omits the `resource` parameter** still gets a token that `/api/mcp` accepts, through `clientRegistrationDefaultResources: [mcpUrl]`. Test: Task 2, "accepts a token issued without a resource parameter".
2. **A Disconnect while a 1-hour access token is still valid** refuses that token at once, through the consent check. Test: Task 5, "refuses the app's token and refresh token after Disconnect".
3. **An amount that builds an item outside the app's limits** (for example 20 kg of oil is 180,000 kcal, over the 50,000 cap) gets a tool error, not a 500 or a stored row. Test: Task 3, "refuses an amount whose numbers are past the app's limits".
4. **A space id that belongs to another tool** (a Budget space) or to nobody gets "That Fitness space wasn't found." Test: Task 3, "refuses a space that isn't a Fitness space".
5. **Auth pages without an OAuth query** (`/sign-in`, `/verify?email=…`) behave exactly as before: no `oauth_query` is sent and sign-in still goes to `/list`. Test: Task 6, "signs in to the app as before when no app is waiting".

---

### Task 1: OAuth provider in Better Auth

**Files:**
- Modify: `apps/api/package.json` (add the three API dependencies)
- Modify: `apps/api/src/shared/db/auth-schema.ts` (plugin tables)
- Create: `apps/api/drizzle/0027_oauth_provider.sql` (via `pnpm --filter api db:generate --name oauth_provider`)
- Modify: `apps/api/src/features/auth/src/create-auth.ts`
- Modify: `apps/api/src/features/auth/index.ts` (export `mcpUrlFor`)
- Create: `apps/api/src/features/auth/src/oauth-test-flow.ts` (test helper)
- Test: `apps/api/src/features/auth/src/oauth-provider.test.ts`

**Interfaces:**
- Produces:
  - `mcpUrlFor(baseURL: string): string`, which returns `new URL('/api/mcp', baseURL).href`.
  - Drizzle tables exported from `auth-schema.ts` under the plugin model names: `jwks`, `oauthClient`, `oauthResource`, `oauthClientResource`, `oauthRefreshToken`, `oauthAccessToken`, `oauthConsent` and `oauthClientAssertion`.
  - `runOAuthFlow(auth: Auth, opts?: { scope?: string; resource?: string | null; email?: string }): Promise<{ accessToken: string; refreshToken: string; userId: string; clientId: string; cookie: string }>`:
    - It signs up and verifies a user (the OTP is captured through the test's `OtpSender`), signs in, registers a public client with redirect `https://claude.ai/api/mcp/auth_callback`, authorizes with PKCE S256 (the default `scope` is `'openid profile offline_access fitness'`, and the default `resource` is the MCP URL; `null` leaves it out), accepts consent, and exchanges the code.
    - It drives every step through `auth.handler(new Request(...))` with the session cookie.
  - `testAuth(): Promise<{ auth: Auth; db: Db }>`, which runs `createAuth` on `createTestDb()` with `baseURL: 'http://localhost:3000'` and captures OTPs.

- [ ] **Step 1: Add the dependencies.** Run `pnpm --filter api add @better-auth/oauth-provider@1.7.18 @modelcontextprotocol/sdk@1.32.2 jose@6.2.16`. Expected: the install succeeds, and `pnpm ls better-auth --filter api` still shows 1.7.18.
- [ ] **Step 2: Write the failing tests** in `oauth-provider.test.ts`:

```ts
it('serves authorization-server metadata with registration, PKCE S256 and the fitness scope', async () => {
  const meta = await auth.api.getOAuthServerConfig();
  expect(meta.registration_endpoint).toMatch(/\/oauth2\/register$/);
  expect(meta.code_challenge_methods_supported).toContain('S256');
  expect(meta.scopes_supported).toEqual(expect.arrayContaining(['openid', 'profile', 'offline_access', 'fitness']));
});
it('lets an app register itself without credentials', async () => {
  const res = await auth.handler(new Request('http://localhost:3000/api/auth/oauth2/register', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], token_endpoint_auth_method: 'none' }) }));
  expect(res.ok).toBe(true);
  expect((await res.json()).client_id).toEqual(expect.any(String));
});
it('issues a JWT access token for the MCP URL with the fitness scope after sign-in and consent', async () => {
  const { accessToken, refreshToken, userId } = await runOAuthFlow(auth);
  const claims = decodeJwt(accessToken);
  expect([claims.aud].flat()).toContain('http://localhost:3000/api/mcp');
  expect(claims.sub).toBe(userId);
  expect(String(claims.scope)).toContain('fitness');
  expect(refreshToken).toEqual(expect.any(String));
});
it('refuses to exchange a code without its PKCE verifier', /* run the flow up to the code, POST /oauth2/token without code_verifier → not ok */);
```

- [ ] **Step 3: Run the tests.** Run `pnpm --filter api exec vitest run src/features/auth/src/oauth-provider.test.ts`. Expected: FAIL (`getOAuthServerConfig` is not a function, and the helper is missing).
- [ ] **Step 4: Add the plugin tables.**
  - Generate their Drizzle definitions with the Better Auth CLI at 1.7.18 against a scratch config that uses the same plugins. If the CLI can't run, hand-write them from `oauthProvider(...).schema` and `jwt().schema`.
  - Add them to `auth-schema.ts` in the existing style (snake_case columns, `timestamp`, `onDelete: 'cascade'` to `user`).
  - Run `pnpm --filter api db:generate --name oauth_provider`. Expected: `0027_oauth_provider.sql` creates only the new tables.
- [ ] **Step 5: Configure the plugins in `createAuth`.**
  - Set `plugins: [emailOTP(...), jwt(), oauthProvider({...})]`, with these `oauthProvider` options:
    - `loginPage: '/sign-in'` and `consentPage: '/oauth/consent'`;
    - `scopes: ['openid','profile','offline_access','fitness']`;
    - `clientRegistrationDefaultScopes` and `clientRegistrationAllowedScopes` set to the same list;
    - `allowDynamicClientRegistration: true` and `allowUnauthenticatedClientRegistration: true`;
    - `clientRegistrationRequirePKCE: true`;
    - `resources: [mcpUrlFor(baseURL)]` and `clientRegistrationDefaultResources: [mcpUrlFor(baseURL)]`;
    - `accessTokenExpiresIn: 3600` and `refreshTokenExpiresIn: 2_592_000`.
  - Add `disabledPaths: ['/token']` only if the provider's docs require it for the `jwt` plugin; ledger which you chose.
  - Write `oauth-test-flow.ts`.
- [ ] **Step 6: Run the tests.** Run the Step 3 command, then `pnpm --filter api exec vitest run src/features/auth`. Expected: PASS, and the existing `create-auth.test.ts` stays green.
- [ ] **Step 7: Commit.** Skip it (the owner commits).

### Task 2: Token check and discovery routes

**Files:**
- Create: `apps/api/src/features/mcp/src/mcp-auth.ts`
- Create: `apps/api/src/features/mcp/src/well-known.ts`
- Modify: `apps/web/next.config.ts` (add the rewrite `{ source: '/.well-known/:path*', destination: `${apiOrigin}/.well-known/:path*` }`)
- Test: `apps/api/src/features/mcp/src/mcp-auth.test.ts` and `well-known.test.ts`

**Interfaces:**
- Consumes: `runOAuthFlow`, `testAuth`, `mcpUrlFor` and `oauthConsent` (Task 1).
- Produces:
  - `type McpCaller = { userId: string; clientId: string }`.
  - `verifyMcpToken(auth: Auth, db: Db, authorization: string | undefined): Promise<McpCaller | null>`:
    - It needs a `Bearer ` prefix.
    - `jose.jwtVerify` checks the token against `createLocalJWKSet(await auth.api.getJwks())`, with the issuer from `auth.api.getOAuthServerConfig()` and audience `mcpUrlFor(auth.options.baseURL)`.
    - The `scope` claim must include `fitness`.
    - The client id is `azp`, falling back to `client_id`.
    - An `oauthConsent` row must exist for that user and client, and its scopes must include `fitness`.
    - Any failure gives `null`.
  - `protectedResourceMetadata(baseURL: string, issuer: string)`, which returns `{ resource: mcpUrl, authorization_servers: [issuer], scopes_supported: ['fitness'], bearer_methods_supported: ['header'] }`.
  - `mountWellKnown(app: express.Express, auth: Auth): void`, which serves:
    - every path under `/.well-known/oauth-authorization-server`, through `toNodeHandler(oauthProviderAuthServerMetadata(auth))`;
    - every path under `/.well-known/openid-configuration`, through `oauthProviderOpenIdConfigMetadata(auth)`;
    - every path under `/.well-known/oauth-protected-resource`, as `protectedResourceMetadata` JSON.

- [ ] **Step 1: Write the failing tests.** In `mcp-auth.test.ts`:
  - 'accepts a real access token and names its user and app' (it gives `{ userId, clientId }` from `runOAuthFlow`);
  - 'refuses a missing, non-Bearer or malformed header' (`undefined`, `'Basic abc'` and `'Bearer nope'` all give `null`);
  - 'refuses a token without the fitness scope' (the flow with `scope: 'openid offline_access'`);
  - 'refuses a token for another audience, and an expired one': mint them with `auth.api.signJWT({ body: { payload: { sub, azp: clientId, scope: 'fitness', aud: 'https://elsewhere.example' } } })`, and with `exp` 60 s in the past;
  - 'refuses a token once its consent is gone' (`db.delete(oauthConsent)`, then `null`);
  - 'accepts a token issued without a resource parameter' (`runOAuthFlow(auth, { resource: null })`; Review Focus 1).

  In `well-known.test.ts`, mount on a bare express app and use supertest:
  - `GET /.well-known/oauth-protected-resource/api/mcp` equals the metadata for `http://localhost:3000/api/mcp`;
  - `GET /.well-known/oauth-authorization-server` and the same path with the issuer's path appended both return `authorization_endpoint` and `registration_endpoint`.
- [ ] **Step 2: Run the tests.** Run `pnpm --filter api exec vitest run src/features/mcp`. Expected: FAIL (the modules are missing).
- [ ] **Step 3: Implement** `mcp-auth.ts` and `well-known.ts` per the Interfaces, and add the Next rewrite.
- [ ] **Step 4: Run the tests.** Run the Step 2 command. Expected: PASS.
- [ ] **Step 5: Commit.** Skip it.

### Task 3: Fitness tools

**Files:**
- Create: `apps/api/src/features/mcp/src/mcp-schemas.ts`
- Create: `apps/api/src/features/mcp/src/food-amounts.ts`
- Create: `apps/api/src/features/mcp/src/fitness-mcp-tools.ts`
- Test: `apps/api/src/features/mcp/src/fitness-mcp-tools.test.ts`

**Interfaces:**
- Consumes:
  - `FitnessFoodService` (`searchFoods`, `foodsById`, `addLogs`, `logs`, `removeLog`);
  - `FitnessWorkoutService` (`listExercises`, `createWorkout`, `workouts`, `removeWorkout`);
  - `FitnessService` (`saveWeight`, `assertSpace`);
  - `SpaceAccessService` (`resolve`, `resolveRow`, `sharedWith`);
  - `SpaceLockService.isOpen(userId, spaceId, undefined)`;
  - `foodItemFields`, `meal` and `workoutSchema` from `fitness-schemas.ts`.
- Produces:
  - `class ToolError extends Error`.
  - Zod objects in `mcp-schemas.ts`:
    - Shared fields:
      - `day` is `z.iso.date()`, described as "The user's local date, YYYY-MM-DD".
      - `spaceId` is `z.uuid().optional()`.
    - Food items:
      - `foodItemInput` is a union of:
        - `{ foodId: uuid, grams: 0.1–20000 }`;
        - `{ foodId: uuid, servingId: uuid, servings: 0.01–100 }`;
        - `{ name: 1–120 chars, grams: 0.1–20000, kcal: 0–50000, proteinG, carbsG, fatG, fiberG: 0–20000 }`.
      - `logFoodInput` is `{ spaceId, day, meal, items: 1–30 }`.
    - Workouts:
      - `workoutSetInput` is `{ reps?: int 0–1000, kg?: 0–1000, seconds?: int 0–86400, meters?: 0–1_000_000 }`.
      - `workoutExerciseInput` is `{ exerciseId?: uuid, name?: 1–80, sets: 1–30 }`, refined so that it has an `exerciseId` or a `name`.
      - `logWorkoutInput` is `{ spaceId, day, name: 1–80, exercises: 1–60 }`.
    - The rest:
      - `searchInput` is `{ spaceId, query: 1–100 }`.
      - `dayInput` is `{ spaceId, day }`.
      - `logWeightInput` is `{ spaceId, day, kg: 20–400 }`.
      - `removeInput(idName)` is `{ [idName]: uuid }`.
  - `food-amounts.ts`:
    - `itemForFood(food: FoodDto, quantity: number, serving: { label: string; amountMg: number })`, the same math as the web's `itemFor`;
    - `oneOffItem(input)`, which gives `foodId: null`, `servingLabel: 'g'`, `quantityMilli = amountMg = round(grams × 1000)` and macros of `round(g × 1000)` in mg;
    - `grams(mg: number): number`, rounded to 1 decimal.
  - `@Injectable() class FitnessMcpTools`, whose methods take `userId` first:
    - `listSpaces(userId)` returns `{ id, title, shared }[]`. It covers own Fitness spaces that aren't deleted or locked and whose folder isn't deleted, plus `sharedWith` rows with `tool === 'fitness'`, `access === 'edit'` and no `lockHash`.
    - `searchFoods(userId, input)` returns `{ spaceId, foods: { id, name, per100g: { kcal, proteinG, carbsG, fatG, fiberG }, servings: { id, label, grams }[] }[] }`.
    - `logFood(userId, input)` returns `{ logged: { id, name, amount, kcal }[], totals }`, where `totals` is `{ kcal, proteinG, carbsG, fatG, fiberG }` for the day and counts eaten rows only.
    - `searchExercises(userId, input)` returns `{ spaceId, exercises: { id, name, kind, muscles }[] }`: every query word in the name, at most 30.
    - `logWorkout(userId, input)` returns `{ id, name, exercises: number, sets: number }`.
    - `getDay(userId, input)` returns `{ day, meals: Record<'breakfast'|'lunch'|'dinner'|'snack', { id, name, amount, kcal, proteinG, carbsG, fatG, fiberG, planned }[]>, totals, workouts: { id, name, exercises: { name, sets: number }[] }[] }`.
    - `removeFoodLog(userId, { logId })` and `removeWorkout(userId, { workoutId })` return `{ removed: string }`, the item's name.
    - `logWeight(userId, input)` returns `{ day, kg }`.
  - Space choice (a private `space(userId, spaceId?)`):
    - **No id given:**
      - With no editable Fitness space: "There's no Fitness space you can edit. Create one in Daybook first."
      - With exactly one, it uses that one.
      - With several: "Ask which Fitness space: Home (<id>), Gym (<id>)."
    - **An id given:**
      - It resolves `edit` access, then `fitness.assertSpace(ownerId, spaceId)`.
      - Not found or the wrong tool gives "That Fitness space wasn't found."
      - View-only gives "You can only view this space."
      - Locked gives the lock message.
  - Other behaviour:
    - `amount` text is `"120 g"` or `"2 × large egg"`, as the web's `formatQuantity` writes it.
    - An unknown food id gives "That food isn't in this space. Use search_foods first."
    - An unknown serving gives "That serving isn't one of this food's. Use search_foods to see its servings."
    - An unknown exercise id gives "That exercise isn't in this space. Use search_exercises first."
    - An item that fails `foodItemFields` gives "That amount is too large to log."
    - A named exercise's kind is `weight` if any set has `kg`, else `time` if any has `seconds`, else `reps`, and its muscles are `[]`.
    - Sets become `{ reps, weightG: round(kg × 1000), seconds, meters, done: true }`, with nulls for anything not given.
    - Removals go through `resolveRow(..., 'edit')` and the lock check, then the service. A missing row gives "That entry wasn't found."

- [ ] **Step 1: Write the failing tests** (PGlite with `createTestDb`, `insertUser`, `insertSpace({ tool: 'fitness' })` and `insertShare`; foods and servings inserted directly; the tools built with real services). Each test has exact values:
  1. 'lists Fitness spaces the person can edit, leaving out view-only, locked, trashed and other tools'.
  2. 'uses the only Fitness space when none is given, and asks which when there are several': the error contains `Ask which Fitness space` and both titles.
  3. 'logs a food by id and grams from its per-100 g numbers': the egg is `kcal 155, proteinMg 13000, carbsMg 1100, fatMg 11000, fiberMg 0`. With `grams: 120`, the row is `{ foodId: egg, eaten: true, servingLabel: 'g', quantityMilli: 120000, amountMg: 120000, kcal: 186, proteinMg: 15600, carbsMg: 1320, fatMg: 13200, fiberMg: 0 }`.
  4. 'logs a number of a food's servings': the serving is `large egg`, 50000 mg. With `servings: 2`, the row is `{ quantityMilli: 2000, servingLabel: 'large egg', amountMg: 100000, kcal: 155 }`.
  5. 'logs a one-off food from the assistant's estimate without creating a food': `{ name: 'Toast with butter', grams: 40, kcal: 150, proteinG: 4, carbsG: 18, fatG: 7, fiberG: 1.5 }` gives `foodId: null, proteinMg: 4000, fiberMg: 1500`, and the `fitness_foods` count is unchanged.
  6. 'refuses a food id the space cannot see' (another space's custom food).
  7. 'refuses a serving id that is not one of the food's servings'.
  8. 'refuses a view-only shared space and a locked space' (exact messages).
  9. 'logs into a shared space the person can edit, under its owner' (the row's `userId` is the owner).
  10. 'refuses a space that isn't a Fitness space': a Budget space id, and a random uuid. Both give "That Fitness space wasn't found." (Review Focus 4)
  11. 'refuses an amount whose numbers are past the app's limits': a 900 kcal per 100 g food at `grams: 20000` is refused, and no row is stored. (Review Focus 3)
  12. 'logs a workout with every set done, taking a found exercise's name and muscles, and a named one with none': the exercise id plus `{ kg: 60, reps: 8 }` gives `weightG: 60000, done: true` and the DB name and primary muscles. `{ name: 'Plank', sets: [{ seconds: 60 }] }` gives `kind: 'time', primary: []`.
  13. 'gives a day by meal with totals counting eaten rows only, and its workouts' (a planned `eaten: false` row is listed with `planned: true` and left out of the totals).
  14. 'removes a log and a workout, but not another person's' (a stranger's id gives "That entry wasn't found.").
  15. 'saves a weigh-in in kg': `kg: 81.5` gives `weightG: 81500`.
  16. 'searches foods and exercises, giving per-100 g numbers in grams': the egg gives `per100g.proteinG: 13`.
- [ ] **Step 2: Run the tests.** Run `pnpm --filter api exec vitest run src/features/mcp/src/fitness-mcp-tools.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `mcp-schemas.ts`, `food-amounts.ts` and `fitness-mcp-tools.ts` per the Interfaces.
- [ ] **Step 4: Run the tests.** Run the Step 2 command. Expected: 16/16 PASS.
- [ ] **Step 5: Commit.** Skip it.

### Task 4: The MCP endpoint

**Files:**
- Create: `apps/api/src/features/mcp/src/mcp-server.ts`
- Create: `apps/api/src/features/mcp/src/mcp-endpoint.ts`
- Create: `apps/api/src/features/mcp/src/mcp-module.ts` and `apps/api/src/features/mcp/index.ts`
- Modify: `apps/api/src/app-module.ts` (import `McpModule`)
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/src/features/mcp/src/mcp-endpoint.test.ts`

**Interfaces:**
- Consumes: `verifyMcpToken` and `mountWellKnown` (Task 2), `FitnessMcpTools`, `ToolError` and the input schemas (Task 3), and `AUTH` and `DB`.
- Produces:
  - `buildMcpServer(tools: FitnessMcpTools, userId: string): McpServer`, with server info `{ name: 'daybook', version: '1.0.0' }`.
    - It registers `list_fitness_spaces`, `search_foods`, `log_food`, `search_exercises`, `log_workout`, `get_day`, `remove_food_log`, `remove_workout` and `log_weight` with the Task 3 input schemas.
    - Results are `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`.
    - A `ToolError`, or a Nest `HttpException` under 500, gives `{ isError: true, content: [{ type: 'text', text: message }] }`.
    - Anything else is logged and gives `isError` with "Something went wrong in Daybook. Try again."
    - The descriptions say: "the user's local date"; "search first, then log by id"; and "log a one-off food with your own estimate only when search_foods finds nothing that fits".
  - `MCP_PATH = '/api/mcp'` and `mcpBodyParser = () => express.json({ limit: '1mb' })`.
  - `@Injectable() class McpEndpoint` (`AUTH`, `DB`, `FitnessMcpTools`):
    - `handle(req, res): Promise<void>`: with no caller, it answers 401 `{ error: 'invalid_token' }` with `WWW-Authenticate: Bearer resource_metadata="<baseURL>/.well-known/oauth-protected-resource/api/mcp"`. Otherwise it creates a new server and a `StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`, connects them, calls `handleRequest(req, res, req.body)`, and closes both on `res` `'close'`.
    - `notAllowed(req, res)` answers 405.
- `main.ts`, before the global `express.json`:
  - `mountWellKnown(instance, auth)`;
  - `app.use(MCP_PATH, mcpBodyParser())`;
  - `instance.post(MCP_PATH, (q, s) => app.get(McpEndpoint).handle(q, s))`;
  - `instance.all(MCP_PATH, (q, s) => app.get(McpEndpoint).notAllowed(q, s))`.

- [ ] **Step 1: Write the failing tests.** Set up a bare express app with `mcpBodyParser()` and the endpoint, built with `new McpEndpoint(auth, db, tools)` and listening on port 0. Use the SDK's `Client` and `StreamableHTTPClientTransport` with `requestInit.headers.Authorization` taken from `runOAuthFlow`.
  - 'answers 401 with the resource metadata pointer when there is no token': check the exact header value for `http://localhost:3000`.
  - 'lists the nine Fitness tools to a connected app': compare the sorted names.
  - 'logs a weigh-in through a tool call': `log_weight { day: '2026-11-21', kg: 80 }` returns text whose JSON is `{ day: '2026-11-21', kg: 80 }`, and the row exists under the user.
  - 'returns tool problems as tool errors, not HTTP errors': `log_weight` with no Fitness space gives `isError: true` with the "There's no Fitness space…" text.
  - 'refuses a malformed day before running the tool': `day: '21/11/2026'` gives `isError` and no row.
  - 'answers 405 to GET' and 'refuses a body over 1 MB with 413'.
- [ ] **Step 2: Run the tests.** Run `pnpm --filter api exec vitest run src/features/mcp/src/mcp-endpoint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `mcp-server.ts`, `mcp-endpoint.ts`, the module (providers `FitnessMcpTools`, `McpEndpoint` and the Task 5 pieces; it imports `FitnessModule`, `SpacesModule` and `AuthModule`, exporting what's missing), `index.ts` and the `main.ts` mounts.
- [ ] **Step 4: Run the tests.** Run the Step 2 command, then `pnpm --filter api exec tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit.** Skip it.

### Task 5: Connected apps API

**Files:**
- Create: `apps/api/src/features/mcp/src/connected-apps-service.ts` and `connected-apps-controller.ts`
- Modify: `apps/api/src/features/mcp/src/mcp-module.ts`
- Test: `apps/api/src/features/mcp/src/connected-apps-service.test.ts` and `connected-apps-controller.test.ts`

**Interfaces:**
- Consumes: the `oauthConsent`, `oauthClient`, `oauthAccessToken` and `oauthRefreshToken` tables, `runOAuthFlow` and `verifyMcpToken`.
- Produces:
  - `type ConnectedApp = { id: string; name: string; connectedAt: string; scopes: string[] }`, where `id` is the consent id and `name` is the client's name or `'Unnamed app'`.
  - `ConnectedAppsService.list(userId): Promise<ConnectedApp[]>`, newest first.
  - `ConnectedAppsService.disconnect(userId, id): Promise<void>`: in one transaction it checks the consent belongs to the user (otherwise NotFound 'App not found'), deletes that user's `oauthAccessToken` and `oauthRefreshToken` rows for the client, then the consent.
  - Routes: `GET /api/connected-apps` and `DELETE /api/connected-apps/:id`, both with `AuthGuard` and `@UserId()`.

- [ ] **Step 1: Write the failing tests.**
  - 'lists the apps a person has connected, with name, scopes and when': after `runOAuthFlow`, the list is `[{ name: 'Claude', scopes: expect.arrayContaining(['fitness']) }]`.
  - 'refuses the app's token and refresh token after Disconnect': `verifyMcpToken` of the old access token gives `null`, and a `grant_type=refresh_token` POST to `/api/auth/oauth2/token` is not ok. (Review Focus 2)
  - 'leaves other people's apps alone': a stranger's `disconnect` throws 'App not found', and the app is still listed for its owner.
  - Controller: GET gives 200 with the list and DELETE gives 200; an unknown id gives 404; no session gives 401. Use the same harness as `uptime-controller.test.ts`.
- [ ] **Step 2: Run the tests.** Run `pnpm --filter api exec vitest run src/features/mcp/src/connected-apps`. Expected: FAIL.
- [ ] **Step 3: Implement** the service and controller, and register them in `McpModule`.
- [ ] **Step 4: Run the tests.** Run the Step 2 command. Expected: PASS.
- [ ] **Step 5: Commit.** Skip it.

### Task 6: Web sign-in continues the authorization, and the consent page

**Files:**
- Modify: `apps/web/package.json` (`pnpm --filter web add @better-auth/oauth-provider@1.7.18`)
- Modify: `apps/web/src/shared/services/auth-client.ts` (`plugins: [emailOTPClient(), oauthProviderClient()]`)
- Modify: `apps/web/src/features/auth/src/SignInPageComponent.tsx`
- Create: `apps/web/src/features/auth/src/OAuthConsentPageComponent.tsx`
- Create: `apps/web/src/app/oauth/consent/page.tsx` (composes only; wrap it in Suspense the way `verify/page.tsx` does)
- Modify: `apps/web/src/features/auth/index.ts`
- Test: `SignInPageComponent.test.tsx` (extend) and `OAuthConsentPageComponent.test.tsx`

**Interfaces:**
- Consumes: the provider's `/oauth2/public-client` (`authClient.oauth2.publicClient({ query: { client_id } })`) and `/oauth2/consent` (`authClient.oauth2.consent({ accept })`), which answer `{ redirect: true, url }`. The client plugin attaches the signed `oauth_query` from `window.location.search` only when it carries `sig`.
- Produces:
  - **Sign-in:** after a successful sign-in, if `result.data` has `redirect === true` and a string `url`, it calls `window.location.assign(url)` and does not push `/list`.
  - **The consent page:**
    - It reads `client_id` from the URL. Its React Query key is `['oauth-client', clientId]`, and while that loads it shows `AuthCardSkeletonComponent`.
    - It is an `AuthCardComponent` titled "Connect <name>", with the copy "<name> wants to log food, workouts and weight in your Fitness spaces." and "You can disconnect it any time in Settings → Connected apps."
    - **Allow** sends `accept: true` and **Deny** sends `accept: false`. Either one then goes to the returned `url`.
    - Both buttons are disabled while a request is in flight.
    - If the name fetch fails, the name is "An app". If the request fails, the error is "Could not finish connecting. Try again from the app."
  - Read the Next docs on `useSearchParams` and Suspense under `apps/web/node_modules/next/dist/docs/` before writing the page.

- [ ] **Step 1: Write the failing tests.**
  - 'continues to the waiting app after sign-in': mock `signIn.email` to resolve `{ data: { redirect: true, url: 'https://claude.ai/api/mcp/auth_callback?code=abc' } }`. `window.location.assign` gets that URL, and `router.push` is not called.
  - 'signs in to the app as before when no app is waiting': the existing push to `/list` stays. (Review Focus 5)
  - 'names the app and says what it may do': the public client is `{ client_name: 'Claude' }`. The heading is "Connect Claude", and the sentence is shown.
  - 'Allow accepts and goes back to the app' and 'Deny refuses and goes back to the app': check the `accept` value and the `assign` URL.
  - 'falls back to "An app" when the app can't be looked up'.
- [ ] **Step 2: Run the tests.** Run `pnpm --filter web exec vitest run src/features/auth`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** per the Interfaces.
- [ ] **Step 4: Run the tests.** Run the Step 2 command, then `pnpm --filter web exec tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit.** Skip it.

### Task 7: Settings → Connected apps

**Files:**
- Create: `apps/web/src/features/connected-apps/index.ts`
- Create: `apps/web/src/features/connected-apps/src/connected-apps-api.ts`, `sample-connected-apps.ts` and `ConnectedAppsComponent.tsx`
- Create: `apps/web/src/features/connected-apps/hooks/useConnectedApps.ts`
- Modify: `apps/web/src/features/settings/src/SettingsPageComponent.tsx`
- Test: `ConnectedAppsComponent.test.tsx` and the Settings page test (extend it, or create one if it's missing)

**Interfaces:**
- Consumes: `GET /api/connected-apps` and `DELETE /api/connected-apps/:id` (Task 5).
- Produces:
  - **The data layer:**
    - The query key is `['connected-apps']`.
    - `useConnectedApps()` returns `{ apps, isPending, disconnect(app) }`.
    - Disconnect is optimistic: it removes the row and toasts "Disconnected <name>". On an error it restores the snapshot and toasts "Could not disconnect <name>". There is no Undo, because a grant can't be re-created.
  - **The settings section:**
    - A third tab: `{ id: 'apps', label: 'Connected apps', Icon: Plug }`.
    - The section heading is "Connected apps", with the copy "Apps like ChatGPT, Claude or Gemini that you've let log food, workouts and weight in your Fitness spaces. Disconnecting one stops it at once." and "To connect one, add `<origin>/api/mcp` as a custom connector in the app."
  - **The rows:**
    - Each row shows the name, "Connected <d MMM yyyy>" and a Disconnect button.
    - The empty state is "No apps connected yet."
    - Loading uses Skullet over the sample data.

- [ ] **Step 1: Write the failing tests.**
  - 'lists connected apps with when they connected';
  - 'shows the empty state';
  - 'Disconnect removes the app and calls DELETE';
  - 'a failed Disconnect brings the app back with a toast';
  - Settings 'shows a Connected apps tab that opens the section'.
- [ ] **Step 2: Run the tests.** Run `pnpm --filter web exec vitest run src/features/connected-apps src/features/settings`. Expected: FAIL.
- [ ] **Step 3: Implement** per the Interfaces.
- [ ] **Step 4: Run the tests.** Run the Step 2 command. Expected: PASS.
- [ ] **Step 5: Commit.** Skip it.

### Task 8: Docs, whole suite and a real client

**Files:**
- Create: `docs/claude/mcp.md` (the MCP rules: the endpoint, auth and consent check, the tools and their units, locked and shared rules, Disconnect, and the public HTTPS requirement)
- Modify: `CLAUDE.md` (add "- MCP rules: OAuth, the /api/mcp tools, connected apps. @docs/claude/mcp.md")
- Modify: `docs/claude/architecture.md` (request path: `/.well-known/*` is rewritten to the API, and `/api/mcp` takes a bearer token instead of the cookie)
- Modify: `docs/claude/web.md` (query keys `['connected-apps']` and `['oauth-client', clientId]`)
- Modify: `docs/claude/fitness.md` (one line: assistants log through MCP, under the same rules)
- Modify: `README.md`:
  - a "Connect an AI app" section: the URL, and the fact that ChatGPT and claude.ai need the public HTTPS site or a `cloudflared tunnel --url http://localhost:3000`;
  - under "Before deploying", that `/api/auth/oauth2/register` is open to anyone and needs the same IP rate limit as sign-in.

**Interfaces:** none (no new code).

- [ ] **Step 1: Write the docs** above. Ruling already made: the production nginx config sends every path (`location /`) to the same upstream, so `/.well-known/*` needs no nginx change, only the Next rewrite. Say so in `mcp.md`.
- [ ] **Step 2: Run the whole suite.** Run `pnpm -r exec vitest run`, then `pnpm -r exec tsc --noEmit`. Expected: every test passes and tsc is clean.
- [ ] **Step 3: Check with a real client.**
  - Run `pnpm run dev`, then `npx @modelcontextprotocol/inspector`.
  - Connect to `http://localhost:3000/api/mcp` with OAuth, sign in, and Allow.
  - Call `list_fitness_spaces` and `log_weight`, and see the weigh-in in the app.
  - Disconnect in Settings, and see the next call answer 401.
  - Expected: all of the above. If anything differs, debug it and ledger the result.
- [ ] **Step 4: Update the graph.** Run `graphify update .`. Expected: the graph is updated.
- [ ] **Step 5: Commit.** Skip it, and write the ready-to-paste commit message.
