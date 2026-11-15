# Live presence and live diagram editing

Date: 2026-11-16. Builds on the sharing design (`2026-11-15-sharing-design.md`).

## Why

Spaces can now be shared, but the people sharing a space can't tell when someone else is in it with them. The owner wants to see at a glance who else has the space open, on every tool. In the Database diagram, where people work on one design together, they want Figma-style collaboration: each person's cursor visible, and every change appearing for everyone as it happens.

## Goals

1. **Who's here, on every tool.** Each tool's header (List, Notebook, Book, Budget, Fitness, Job hunt, Database diagram) shows a small stack of round avatars for the other people who have that space open right now.
   - Each avatar is the person's picture (`user.image`), or their initials on a muted circle when they have none. Today nobody has a picture, since sign-up is email and password only, so everyone shows initials.
   - Hovering an avatar (a shadcn Tooltip) shows the name and access: "Jane Doe · Can edit", "· Can view" or "· Owner".
   - You are never shown. Alone in a space, the header looks exactly as it does today.
   - The same person in two tabs or devices shows once.
   - Someone appears within about a second of opening the space and disappears within about 30 seconds of closing it or losing their connection (immediately on a clean close).
   - From the fifth person on, a "+N" circle replaces the extra avatars, and hovering it lists the rest by name.
   - Placement: in the header row, on the right, before any action buttons the header already has.
2. **Live cursors in the Database diagram.** Each other person's mouse pointer shows on the canvas with a small name tag. It follows zoom and pan (stored in diagram coordinates, not screen pixels) and disappears when their pointer leaves the canvas. Their text cursor and selection also show in the DBML editor, with the same name tag.
3. **Live editing in the Database diagram.** Typing in the DBML code and moving tables both show on everyone's screen as they happen. Two people typing at the same time both keep their edits. Viewers ("Can view") see everything live but can't change anything.

## Non-goals

- Uploading a profile picture. The avatar shows one if `user.image` is ever set, and that's all.
- Live editing in any other tool. Notebook, Book, Budget and the others get the header avatars only. Their saving and conflict handling stay as they are.
- Running more than one API server. Live state lives in the API process's memory (see Constraints).
- Live presence in Vault. It can't be shared, so nobody else can be in it, and Vault opens no live connection at all.
- Chat, follow-mode, "jump to their cursor" or activity notifications.

## Anti-goals (a failure even if it works)

- A viewer, or anyone without access, changing a diagram through the live connection. The server must enforce this. Hiding the edit controls in the browser is not enough. This is the same rule as sharing: a wrong check is the failure that matters most.
- The live connection revealing that a space exists to someone without access, or getting past a space password.
- A browser claiming to be someone else: names, pictures and roles shown to others come from the server's records, never from what a browser says about itself.
- Typing in a large diagram getting slower. The earlier work (no long tasks at 100 tables in a production build) must still hold, and other people's cursors moving must not redraw the canvas.
- Content duplicating or vanishing when someone reconnects.

## Approaches

| | How | Trade-off |
|---|---|---|
| **A. Yjs (chosen)** | The open-source Yjs library over a WebSocket on the API. Diagram text is a shared Yjs text bound to CodeMirror (`y-codemirror.next`), positions are a shared map, and the Yjs "awareness" channel carries cursors and who's here on every tool. | Simultaneous typing merges correctly with no work from us. It needs a WebSocket server in the API, a handful of new packages, and one API process. |
| B. Our own protocol | Server-sent events out, normal requests back in. | Cursors, presence and table moves are easy. Two people typing at once overwrite each other's keystrokes, and fixing that means rewriting what Yjs does. |
| C. Hosted service (Liveblocks, PartyKit) | Their SDK. | Least code, but diagram content and everyone's names pass through a third party, and it costs money past the free tier. |

The owner picked **A**.

## Decided

### The connection

- One WebSocket per open space, at `/api/realtime/<spaceId>`, served by the API on Nest's HTTP server (`ws` package, `maxPayload` 2 MB to match the JSON limit). The browser connects same-origin. Next's `/api/:path*` rewrite forwards WebSocket upgrades (`router-server.js` `upgradeHandler` → `proxyRequest`), so the session and unlock cookies arrive just as they do for normal requests.
- On the upgrade, the server, in order:
  1. Checks `Origin` against `BETTER_AUTH_URL`, so another site can't open it with the user's cookies.
  2. Reads the session with Better Auth, as `AuthGuard` does.
  3. Runs `SpaceAccessService.resolve(userId, spaceId, 'view')`, which refuses Vault and anything without access.
  4. Runs `SpaceLockService.isOpen` with the cookie header.

  Any failure refuses the upgrade with no detail: no access reads exactly like a missing space.
- A locked space opens no connection until it is unlocked in this browser. The connection starts after `SpaceLockGateComponent` lets the content through, so the people in it only show up once you're in as well.
- Access is not checked only once. While connected, the server checks again every 60 seconds and closes the connection if the space was deleted, unshared, re-locked or changed to view-only. On a downgrade the client reconnects as a viewer.
- Messages follow the standard Yjs sync and awareness protocol (`y-protocols`). On the client, `y-websocket`'s `WebsocketProvider` handles connecting, reconnecting with backoff and resyncing.

### Who's here (all tools)

- Every tool page except Vault opens the connection for the active space. A shared hook, `useSpacePresence()` in `features/spaces`, holds the provider and is reused by the diagram.
- The server knows each connection's user and access, and sends the room's member list itself (one entry per user, with id, name, image and access). Each entry also names that user's Yjs awareness client ids, so cursors can be matched to names. Awareness from the browser carries only the cursor. Any name or identity a browser puts in awareness is ignored.
- `PresenceAvatarsComponent` (in `features/spaces`) renders the list, excluding yourself, and goes in each tool's header next to where `ViewOnlyBadgeComponent` already sits.
- It uses the shadcn Avatar (add it with the CLI, then remove the npm `cn` package it installs and fix the import, as before) and the existing Tooltip. Colours stay monochrome theme tokens.

### Live diagram

- The server keeps one Yjs document per open diagram space: a `Y.Text` named `dbml` and a `Y.Map` named `positions` (`tableName → { x, y }`). Non-diagram rooms have no document, only presence.
- **Saving.** The server writes the document back to the `diagrams` row 800 ms after the last change, and again when the last person leaves.
  - Each write stores `dbml` and `positions` as plain text and JSON as today, so exports, the AI, duplicate and the existing load route keep working from them.
  - It also stores the Yjs document state in a new nullable `ydoc bytea` column.
  - Keeping that state is what stops duplication: a fresh document rebuilt from the plain text would merge with a reconnecting browser's copy and double the content.
  - When a room opens, it loads `ydoc`. When there is none (diagrams saved before this change), it builds the document once from `dbml` and `positions`.
  - Duplicating a diagram space copies the whole row, `ydoc` included.
- **Viewers.** The server answers a viewer's sync requests but drops every document update a viewer sends, so the stored diagram can't change. Viewers still send their cursor.
- **The page.** Text and positions come from the Yjs document instead of local state:
  - Typing, remote edits and AI, import or tidy changes all flow through it.
  - The existing parse pipeline (Web Worker, 300 ms pause, `sameModel`, the last good model kept while the text has errors) runs on the document's text.
  - `placeTables` writes positions only for tables that have none yet.
- **Undo.** The AI, import and tidy toasts keep their Undo. Undo now reverses only that change, using a Yjs `UndoManager` limited to it, so a collaborator's edits made since are kept. Ctrl+Z in the editor undoes only your own typing (the Yjs undo keymap replaces CodeMirror's own history).
- **Old save path removed.** `useDiagramAutosave`, `PUT /diagrams` and the "Changed by someone else" / Reload flow go away: there is nothing left to conflict.
- **Save status.** The header shows "Saved" while connected and in sync, and "Offline, changes will sync" while disconnected. Edits made while offline stay in the tab and merge when it reconnects. Closing the tab while offline loses them, as now.
- **Canvas cursors.** These are a separate overlay component that reads awareness directly. Remote cursor movement never re-renders the memoised canvas or the editor. Your own cursor is sent at most about 20 times a second. Each cursor is a pointer in the foreground colour with the person's name in a small tag.

### Packages

- Web: `yjs`, `y-websocket`, `y-codemirror.next`.
- API: `yjs`, `y-protocols`, `lib0`, `ws`.
- Plus the shadcn Avatar component.

## Constraints

- Live rooms and documents live in one API process's memory. A `ponytail:` comment must say so: running several API servers needs a shared relay (for example a Redis-backed Yjs provider).
- Every API rule still holds: rows stay under the owner's `userId`, the space password is enforced on the server, and Vault stays owner-only.
- Migration: `pnpm --filter api db:generate` for the `ydoc` column. The owner applies migrations themselves.
- Docs: CLAUDE.md's diagram rules and web data flow section change (no autosave or PUT route, the Yjs document as the live source, the new column). Add a short "Live presence" rule section.

## Left to the builder

- Exact file layout for the server room code (a `realtime` feature module is the natural home) and how it's wired into `main.ts`.
- How the member list is sent, for example a custom message type next to sync and awareness.
- The member list is per room (space). Showing who is in a sub-space from a folder view is not needed.
- Tests:
  - API tests boot the app on a free port and connect with a real `ws` client, covering: refused upgrades (no session, no access, Vault, locked, wrong origin), viewer updates dropped, the member list coming from the server, the 60-second recheck closing a removed share (with a shortened interval in tests), and save and reload through `ydoc`.
  - Web tests cover the avatars (initials, +N, tooltip text, yourself excluded), with the provider mocked.

## Calls I made (the owner can overrule any)

- You are not shown in your own avatar stack.
- Four avatars, then "+N".
- Monochrome cursors with name tags, rather than a colour per person, to keep the theme rule.
- The DBML editor also shows other people's text cursors. The Yjs editor binding does this for free.
- Undo reverses only your own change, not collaborators' edits made since.
- The 60-second access recheck interval.
