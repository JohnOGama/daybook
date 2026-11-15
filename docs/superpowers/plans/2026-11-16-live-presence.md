# Live Presence and Live Diagram Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show who else has a space open in every tool's header, and make the Database diagram a live, multi-cursor shared editor.

**Architecture:** The API gets a WebSocket endpoint `/api/realtime/<spaceId>` that speaks the Yjs sync and awareness protocol, with one in-memory room per open space. Every room carries presence. Only Database diagram rooms accept document updates, and only from editors; the server persists them to the `diagrams` row. The web app opens one `y-websocket` provider per active space, inside the space gate. Headers read the server's member list, and the diagram binds its text and positions to the shared Yjs document.

**Tech Stack:** NestJS + `ws`, `yjs`, `y-protocols`, `lib0` on the API. Next.js + `y-websocket`, `y-codemirror.next`, `yjs`, `y-protocols`, React Flow and the shadcn Avatar on the web.

**Spec:** `docs/superpowers/specs/2026-11-16-live-presence-design.md`

## Global Constraints

- Pin exact versions (none newer than two weeks): `yjs@13.6.33`, `y-protocols@1.0.7`, `lib0@0.2.119`, `ws@8.22.1`, `@types/ws@8.18.2` (dev), `y-websocket@3.1.0`, `y-codemirror.next@0.3.6`.
- API: relative imports end in `.ts`, and every constructor dependency gets an explicit `@Inject(Token)`.
- The shadcn CLI installs an npm package `cn` and imports from it. Always `pnpm --filter web remove cn` afterwards and import `cn` from `@/shared/utils/cn`.
- Naming: `*Component.tsx`, `useX.ts` hooks, kebab-case utilities. Monochrome theme tokens only. No spinners; use Skullet for loading.
- No access must look exactly like a missing space: refuse the upgrade with a plain `404`, and use `403` only where a normal route would say "locked".
- Names, pictures and roles shown to others come from the server, never from what a browser claims.
- Live state lives in one API process's memory. Mark it with a `ponytail:` comment naming the upgrade path (a shared relay, for example a Redis-backed Yjs provider).
- Do not run `db:migrate` against the owner's database. Generate the migration and say it needs applying.
- Commit after each task, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Reconnecting after the room was closed and reopened from `ydoc`** (everyone left, then someone's tab reconnects with its old copy). The text must not duplicate. Test: Task 2 "reopened room merges an old client copy without duplicating".
2. **A share removed or downgraded while someone is connected.** Their connection must close within the recheck interval, and a downgraded user must no longer be able to change the diagram. Test: Task 3 "closes a connection whose share was removed".
3. **A crafted message from a viewer or a non-diagram room** (a sync step 2 or an update carrying text). The stored diagram must stay unchanged. Test: Task 2 "drops document updates from a viewer".
4. **One connection setting awareness for another connection's client id**, to move someone else's cursor or rename them. It must be ignored. Test: Task 2 "ignores awareness for a client id owned by another connection".
5. **The API shutting down within 800 ms of an edit.** The edit must still be saved. Test: Task 2 "flush saves pending rooms".

---

### Task 1: Store the Yjs document with each diagram

**Files:**
- Modify: `apps/api/src/shared/db/schema.ts` (add `ydoc` to `diagrams`)
- Create: `apps/api/drizzle/0022_*.sql` (generated)
- Modify: `apps/api/src/features/diagrams/src/diagrams-service.ts`
- Test: `apps/api/src/features/diagrams/src/diagrams-service.test.ts`

**Interfaces:**
- Produces:
  - `DiagramsService.loadDoc(spaceId: string): Promise<{ ownerId: string; dbml: string; positions: Positions; ydoc: Uint8Array | null } | null>`. Returns `null` when the space is not a live diagram space; when the space exists but has no row yet, it returns empty text, `{}` and `null`.
  - `DiagramsService.saveDoc(ownerId: string, spaceId: string, doc: { dbml: string; positions: Positions; ydoc: Uint8Array }): Promise<void>`. Upserts the row, bumps `version` and sets `updatedAt`.
- The column is `ydoc: customType bytea`, nullable. Drizzle has no built-in `bytea`, so define a `customType<{ data: Uint8Array }>` with `dataType: () => 'bytea'`.

- [ ] **Step 1: Write the failing tests** in `diagrams-service.test.ts`:
  - `saveDoc then loadDoc round-trips text, positions and ydoc bytes`: `expect(Buffer.from(loaded.ydoc)).toEqual(Buffer.from([1, 2, 3]))`, plus matching `dbml` and `positions`.
  - `loadDoc returns empty text and null ydoc for a diagram space with no row`.
  - `loadDoc returns null for a list space and for a deleted diagram space`.
  - `saveDoc stores the row under the owner and bumps version`: the row's `userId` is the owner and `version` goes 0 → 1 → 2.
- [ ] **Step 2: Run them to see them fail.**
  Run: `pnpm --filter api exec vitest run src/features/diagrams/src/diagrams-service.test.ts`
  Expected: FAIL, `loadDoc is not a function`.
- [ ] **Step 3: Add the column and generate the migration.**
  Run: `pnpm --filter api db:generate`
  Expected: a new `0022_*.sql` with `ALTER TABLE "diagrams" ADD COLUMN "ydoc" bytea;`.
- [ ] **Step 4: Implement `loadDoc` and `saveDoc`.**
  `saveDoc` uses `insert … onConflictDoUpdate` on `spaceId`, with `version: sql\`${diagrams.version} + 1\``. The duplicate in `spaces-service.ts` stays as it is: a copy has no `ydoc`, so its room seeds from the text, which is correct because no browser holds its state. *Changed from spec: the duplicate does not copy `ydoc`.*
- [ ] **Step 5: Run the tests.** Same command. Expected: PASS.
- [ ] **Step 6: Commit** `feat(api): keep the live document with each diagram`.

### Task 2: Realtime rooms (protocol logic, no network)

**Files:**
- Create: `apps/api/src/features/realtime/src/realtime-room.ts`
- Test: `apps/api/src/features/realtime/src/realtime-room.test.ts`
- Modify: `apps/api/package.json` (add `yjs`, `y-protocols`, `lib0`)

**Interfaces:**
- Consumes: Task 1 `loadDoc` and `saveDoc`, which come in through the `RoomStore` shape below.
- Produces:
  ```ts
  export type Member = { userId: string; name: string; image: string | null; access: 'owner' | 'edit' | 'view'; clientIds: number[] };
  export type Peer = { userId: string; name: string; image: string | null; access: Member['access']; send(data: Uint8Array): void; close(): void };
  export type RoomStore = { load(): Promise<{ dbml: string; positions: Positions; ydoc: Uint8Array | null } | null>; save(doc: { dbml: string; positions: Positions; ydoc: Uint8Array }): Promise<void> };
  export const MESSAGE_SYNC = 0, MESSAGE_AWARENESS = 1, MESSAGE_MEMBERS = 100;
  export const SAVE_PAUSE_MS = 800;
  export class Room {
    static async open(spaceId: string, live: boolean, store: RoomStore): Promise<Room>; // live = diagram space: accepts and saves updates
    join(peer: Peer): void;          // sends sync step 1 and current awareness, broadcasts members
    receive(peer: Peer, data: Uint8Array): void;
    leave(peer: Peer): void;         // removes its awareness states, broadcasts members
    setAccess(peer: Peer, access: Member['access']): void;
    get empty(): boolean;
    flush(): Promise<void>;          // saves now if anything is pending
    members(): Member[];             // one entry per userId, clientIds merged across that user's peers
  }
  ```
- The document holds `doc.getText('dbml')` and `doc.getMap('positions')`. The members message is `MESSAGE_MEMBERS` followed by a varString of `JSON.stringify(Member[])`.

- [ ] **Step 1: Write the failing tests.** Fake peers record what is sent to them. Drive them with real Yjs docs and `y-protocols` encoders.
  - `seeds a live room from text and positions when there is no ydoc`: after a client syncs, its `getText('dbml').toString()` equals the stored text, and `getMap('positions').toJSON()` equals the stored positions.
  - `an editor's update reaches the other peer and is saved after 800 ms` (fake timers): `store.save` is called once with the new `dbml`.
  - `drops document updates from a viewer`: a viewer sends sync step 2 and an update that both insert text. The other peer receives nothing, `store.save` is never called, and the room text is unchanged.
  - `drops document updates in a room that is not live` (List, Notebook and the like).
  - `rewrites awareness user to the server's identity`: a peer sets awareness `{ user: { name: 'Mallory' }, cursor: { x: 1, y: 2 } }`. The others receive `user.name === <peer's real name>` and the cursor is kept.
  - `ignores awareness for a client id owned by another connection`.
  - `members lists each user once, with every client id`: two peers for one user produce one entry with two `clientIds`.
  - `reopened room merges an old client copy without duplicating`: client A edits, the room saves and closes, `Room.open` loads the saved `ydoc`, and A syncs its old doc back. The text equals A's text exactly.
  - `flush saves pending rooms` (fake timers, called before 800 ms).
- [ ] **Step 2: Run them to see them fail.**
  Run: `pnpm --filter api exec vitest run src/features/realtime/src/realtime-room.test.ts`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement `Room`.**
  - Seeding when `ydoc` is null: build the doc from text and positions in one transaction.
  - Sync: `syncProtocol.readSyncMessage`. For viewers and non-live rooms, answer step 1 only. Peek at the sync sub-type and drop step 2 and updates without applying them.
  - Awareness: track which `clientIds` each peer introduced. Drop states for ids another peer owns. Before rebroadcasting, overwrite each state's `user` with `{ name, color: '#e5e5e5', colorLight: 'rgb(255 255 255 / 0.14)' }`.
  - Saving: debounce 800 ms with `doc.on('update')`. Save `ytext.toString()`, `ymap.toJSON()` and `Y.encodeStateAsUpdate(doc)`.
  - Add the `ponytail:` single-process comment.
- [ ] **Step 4: Run the tests.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): realtime rooms with server-checked presence`.

### Task 3: The WebSocket endpoint

**Files:**
- Create: `apps/api/src/features/realtime/src/realtime-service.ts`, `apps/api/src/features/realtime/src/realtime-module.ts`, `apps/api/src/features/realtime/index.ts`
- Modify: `apps/api/src/app-module.ts`, `apps/api/src/main.ts`, `apps/api/package.json` (`ws`, `@types/ws`), `apps/api/src/features/diagrams/index.ts` (export `DiagramsService` if it isn't already)
- Test: `apps/api/src/features/realtime/src/realtime-service.test.ts`

**Interfaces:**
- Consumes: Task 2 `Room` and `Peer`; Task 1 `loadDoc` and `saveDoc`; `SpaceAccessService.resolve`; `SpaceLockService.isOpen`; `AUTH` (`auth.api.getSession`).
- Produces:
  - `RealtimeService.attach(server: http.Server): void`, called in `main.ts` before `listen`.
  - `RealtimeService.RECHECK_MS` (default `60_000`, overridable in tests).
  - `onModuleDestroy()`: flushes every room and closes all sockets.
  - Path: `/api/realtime/:spaceId` (exact match). Any other upgrade path is left alone.

- [ ] **Step 1: Write the failing tests.** Boot a Nest app as in the controller tests, with PGlite, the fake `AUTH` that reads `x-test-user`, and `app.listen(0)`. Connect with `new WebSocket(url, { headers: { origin, 'x-test-user': … } })`. Set `process.env.BETTER_AUTH_URL` to the test origin.
  - `refuses with 404: no session, unknown space, someone else's space, a vault space`. Assert the `unexpected-response` status is 404.
  - `refuses a wrong Origin` (403).
  - `refuses a locked space without the unlock cookie (403) and accepts it with one`.
  - `a viewer connects and receives the members list including the owner`.
  - `closes a connection whose share was removed` (`RECHECK_MS = 50`; delete the share row, expect `close` within 500 ms).
  - `an editor's change is saved to the diagrams row` (wait ~1 s, then read the row's `dbml`).
- [ ] **Step 2: Run them to see them fail.**
  Run: `pnpm --filter api exec vitest run src/features/realtime/src/realtime-service.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 })` on the server's `upgrade` event.
  - Check in this order: origin, session, `resolve(userId, spaceId, 'view')`, `isOpen`. On failure, write `HTTP/1.1 <code> …\r\n\r\n` and destroy the socket.
  - Rooms are kept in a `Map<string, Promise<Room>>`. `live` is `tool === 'diagram'`.
  - The store passes to `loadDoc` and `saveDoc` with the resolved `ownerId`.
  - The recheck timer re-runs `resolve` and `isOpen` per peer. On failure it closes the peer, and on a role change it calls `setAccess`.
  - When the last peer leaves: `flush()`, then delete the room if it is still empty.
- [ ] **Step 4: Run the tests.** Same command. Expected: PASS.
- [ ] **Step 5: Run the whole API suite and the type check.**
  Run: `pnpm --filter api exec vitest run && pnpm --filter api exec tsc --noEmit`
  Expected: all pass.
- [ ] **Step 6: Commit** `feat(api): live connection for every shared space`.

### Task 4: Presence in the browser and avatars in every header

**Files:**
- Create: `apps/web/src/features/spaces/hooks/useSpacePresence.ts`, `apps/web/src/features/spaces/src/SpacePresenceProviderComponent.tsx`, `apps/web/src/features/spaces/src/PresenceAvatarsComponent.tsx`, `apps/web/src/shared/components/ui/avatar.tsx` (shadcn CLI)
- Modify: `apps/web/src/features/spaces/src/SpaceGateComponent.tsx`, `apps/web/src/features/spaces/index.ts`, `apps/web/package.json`
- Modify (put `<PresenceAvatarsComponent />` in the header's title row, right-aligned, before any action buttons): `features/tasks/src/TasksHeaderComponent.tsx`, `features/notebook/src/PageListComponent.tsx`, `features/book/src/ChapterOutlineComponent.tsx`, `features/budget/src/BudgetPageComponent.tsx`, `features/fitness/src/FitnessPageComponent.tsx`, `features/jobs/src/JobsPageComponent.tsx`, `features/diagram/src/DiagramPageComponent.tsx`
- Test: `apps/web/src/features/spaces/src/PresenceAvatarsComponent.test.tsx`

**Interfaces:**
- Consumes: Task 3 endpoint and the Task 2 members message format.
- Produces:
  ```ts
  export type PresenceMember = { userId: string; name: string; image: string | null; access: SpaceAccess; clientIds: number[] };
  export type SpacePresence = { doc: Y.Doc; awareness: Awareness; members: PresenceMember[]; connected: boolean; synced: boolean };
  export const SpacePresenceContext: React.Context<SpacePresence | null>;
  export function useSpacePresence(): SpacePresence | null; // null outside a space, in Vault and in folders
  export function SpacePresenceProviderComponent({ space, children }: { space: Space; children: ReactNode }): JSX.Element;
  export function PresenceAvatarsComponent(): JSX.Element | null;
  ```
- The provider is `new WebsocketProvider(\`${wss|ws}://${location.host}/api/realtime\`, space.id, doc)`, with `provider.messageHandlers[100]` reading the members list. It is created in an effect keyed by `space.id` and destroyed on unmount. `SpaceGateComponent` wraps the children it renders for a non-vault `kind === 'space'` active space. The locked path wraps inside `SpaceLockGateComponent`'s unlocked branch, so nothing connects before unlock.

- [ ] **Step 1: Add the packages and the shadcn Avatar.**
  Run: `pnpm --filter web add yjs@13.6.33 y-protocols@1.0.7 y-websocket@3.1.0 y-codemirror.next@0.3.6`, then `pnpm --filter web exec shadcn add avatar`, `pnpm --filter web remove cn`, and fix the import.
- [ ] **Step 2: Write the failing tests** in `PresenceAvatarsComponent.test.tsx`. Render inside `SpacePresenceContext.Provider` with a local `Y.Doc` and `Awareness`, and the session mocked to user `me`.
  - `shows nothing when only you are here`.
  - `shows initials for each other person and their name and access on hover`: `Jane Doe` → `JD`, and the tooltip reads `Jane Doe · Can edit`.
  - `shows the picture when there is one` (an `img` with `alt="Jane Doe"`).
  - `shows four avatars, then +N listing the rest`: six others give four avatars and `+2`, and hovering it lists the two names.
- [ ] **Step 3: Run them to see them fail.**
  Run: `pnpm --filter web exec vitest run src/features/spaces/src/PresenceAvatarsComponent.test.tsx`
  Expected: FAIL.
- [ ] **Step 4: Implement the hook, the provider, the avatars and the seven header placements.**
  Initials are the first letters of the first two words, upper-cased, or the first letter of the email-like name. Existing page tests render without the provider, so `useSpacePresence()` returning `null` must render nothing.
- [ ] **Step 5: Run the web suite and the type check.**
  Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit`
  Expected: all pass.
- [ ] **Step 6: Commit** `feat(web): see who else is in a space`.

### Task 5: Live diagram editing

**Files:**
- Create: `apps/web/src/features/diagram/hooks/useLiveDiagram.ts`
- Modify: `apps/web/src/features/diagram/src/DiagramPageComponent.tsx`, `apps/web/src/features/diagram/src/DbmlEditorComponent.tsx`, `apps/web/src/features/diagram/src/diagram-api.ts` (remove `saveDiagram`), `apps/web/src/features/diagram/src/DiagramPageComponent.test.tsx`, `apps/web/src/features/diagram/src/ReadOnlyDiagram.test.tsx`
- Delete: `apps/web/src/features/diagram/hooks/useDiagramAutosave.ts`, `useDiagramAutosave.test.tsx`
- Modify (API): `apps/api/src/features/diagrams/src/diagrams-controller.ts` (remove `PUT`), `diagrams-schemas.ts` (remove `saveDiagramSchema`), `diagrams-service.ts` (remove `save`), and their tests

**Interfaces:**
- Consumes: Task 4 `useSpacePresence()` (`doc`, `awareness`, `synced`, `connected`).
- Produces:
  ```ts
  export function useLiveDiagram(): {
    text: string; positions: Positions; synced: boolean; connected: boolean;
    ytext: Y.Text; awareness: Awareness;
    setPositions(next: Positions): void;                // writes only changed keys, origin LOCAL
    change(apply: () => void): () => void;              // runs apply in one transaction with a fresh origin; returns an undo for exactly that change
  };
  ```
  - `DbmlEditorComponent` props change to `{ ytext: Y.Text; awareness: Awareness; problems; fresh; scrollTo; readOnly }`. It uses `yCollab(ytext, awareness, { undoManager: new Y.UndoManager(ytext) })` with `Prec.high(keymap.of(yUndoManagerKeymap))`. `readOnly` goes in a `Compartment`, so a role change applies without remounting.

- [ ] **Step 1: Write the failing tests** in `DiagramPageComponent.test.tsx`, with the provider context holding a local `Y.Doc`, `synced: true`, and `diagram-parts` mocked as today.
  - `shows the skeleton until the document is synced`.
  - `renders tables from the shared text, and a remote text change redraws them`: write to `doc.getText('dbml')` outside React, and the new table name appears.
  - `AI change Undo restores the text but keeps a collaborator's later edit to positions`.
  - `tidy writes positions into the shared map`.
  - `shows Saved when connected and "Offline, changes will sync" when not`.
  - In `ReadOnlyDiagram.test.tsx`: `a viewer never writes to the shared document` (the doc's update count stays 0 after interacting).
- [ ] **Step 2: Run them to see them fail.**
  Run: `pnpm --filter web exec vitest run src/features/diagram`
  Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `Workspace` reads `text` and `positions` from `useLiveDiagram` instead of local state and autosave. The parse effect stays as it is, keyed on `text`.
  - `placeTables` results go through `setPositions`, writing only keys missing from the map.
  - `replace` (AI or import) and `handleTidy` run through `change`, and the toast's Undo calls the returned function.
  - The page shows the Skullet skeleton until `synced`. `GET /diagrams` is still used for `aiEnabled`.
  - Remove the PUT route, its schema, `save` and their tests. Keep `version` and `updatedAt` in GET.
- [ ] **Step 4: Run both suites and both type checks.**
  Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit && pnpm --filter api exec vitest run && pnpm --filter api exec tsc --noEmit`
  Expected: all pass.
- [ ] **Step 5: Commit** `feat: edit a database diagram together, live`.

### Task 6: Live cursors on the canvas

**Files:**
- Create: `apps/web/src/features/diagram/src/RemoteCursorsComponent.tsx`
- Modify: `apps/web/src/features/diagram/src/DiagramCanvasComponent.tsx`
- Test: `apps/web/src/features/diagram/src/RemoteCursorsComponent.test.tsx`

**Interfaces:**
- Consumes: Task 4 `useSpacePresence()` (`awareness`, `members`).
- Produces: `RemoteCursorsComponent()`, rendered as a child of `<ReactFlow>` through `<ViewportPortal>`. It reads awareness states other than its own `clientID` that have a `cursor: { x: number; y: number } | null` field, and labels each with the member whose `clientIds` includes that state's id. The canvas sends `awareness.setLocalStateField('cursor', screenToFlowPosition(...))` from `onPointerMove`, at most once per 50 ms, and `null` on `onPointerLeave`.

- [ ] **Step 1: Write the failing tests.**
  - `draws a cursor with the member's name at its diagram position`: a remote state `{ cursor: { x: 120, y: 80 } }` with a member `Jane Doe` produces an element labelled `Jane Doe` with `transform: translate(120px, 80px)`.
  - `hides a cursor set to null and never draws your own`.
  - `a cursor without a matching member is not drawn` (the name comes only from the server).
- [ ] **Step 2: Run them to see them fail.**
  Run: `pnpm --filter web exec vitest run src/features/diagram/src/RemoteCursorsComponent.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement.**
  The component subscribes to `awareness.on('change')` with its own state, so the memoised canvas and the editor never re-render on cursor moves. The pointer is a lucide `MousePointer2` in `text-foreground`, with the name in a small `bg-popover` tag. Hide it under `prefers-reduced-motion` only if it animates; it doesn't need to.
- [ ] **Step 4: Run the tests.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): see collaborators' cursors on the diagram`.

### Task 7: Docs and a full check

**Files:**
- Modify: `CLAUDE.md` (Database diagram rules, web data flow, a new "### Live presence" section)

- [ ] **Step 1: Update `CLAUDE.md`.**
  - Diagram rules: the Yjs document is the live source. The server saves `dbml`, `positions` and `ydoc` 800 ms after the last change. There is no autosave hook and no PUT route. Undo covers only your own change.
  - New "Live presence" section: one WebSocket per open space at `/api/realtime/<spaceId>`, checked like a load (origin, session, access, lock) and rechecked every 60 s. Names come from the server. Viewers' and non-diagram rooms' document updates are dropped. It runs in a single API process.
- [ ] **Step 2: Run everything.**
  Run: `pnpm -r exec vitest run && pnpm --filter api exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter api build && pnpm --filter web build`
  Expected: all pass.
- [ ] **Step 3: Commit** `docs: live presence rules`.
- [ ] **Step 4: Tell the owner** to run `pnpm run db:migrate` (`ydoc` column). A hands-on check needs two signed-in accounts in two browsers, sharing one diagram.
