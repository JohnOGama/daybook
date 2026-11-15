# Sharing spaces and folders

## Intent

The owner wants to give another Daybook user access to one space, or a whole folder, either to edit it or only to view it. That person then finds it under a **Shared with me** section in their sidebar. Examples are a partner keeping a Budget together, or someone looking at a diagram or a list.

This reverses the "Sharing, teams, or assigning tasks to other people" non-goal in `2026-11-09-daybook-design.md`. Teams and assigning tasks to people stay out.

## Goals

- The owner shares a space or folder by email and picks **Can edit** or **Can view**.
- The owner sees who has access, changes their role, and removes them at any time.
- The recipient sees what's shared with them under **Shared with me**, with the owner's name, and uses it with the same tools as their own spaces.
- The server enforces access on every route. The web app only decides what to show.

## Non-goals

- Vault can't be shared. It's encrypted in the browser with the owner's key, so the server can't give access. The Share action is hidden for Vault spaces and the API refuses it.
- No "edited by" history. Everything a shared editor creates is stored under the owner (see Approach).
- No invite or notification emails (**my call**). Email stays for sign-in codes only. A share simply appears in the recipient's sidebar.
- No public or anonymous links. Recipients need a Daybook account.
- Recipients can't share onwards, delete, move, reorder, duplicate or rename the shared space or folder, set its password, or change its carry-over setting (**my call**).
- Recipients don't get a Trash for shared content. Deletes behave as they do for the owner: tasks, pages and spaces go to the owner's Trash, while Budget rows and jobs are hard-deleted, with Undo only in the browser of whoever deleted.
- Live cursors and seeing who's in a page. The owner wants these: another person's avatar, name and cursor inside a Notebook page, Book chapter or diagram, with edits merging live. That is **phase two, a separate design** built on top of this one. It will probably use Yjs with TipTap's collaboration extensions and CodeMirror's Yjs binding, plus a real-time sync server. This design is built so that work can follow without changes to how access works.

## Anti-goals

- Anyone sees, or can change, content in a space that wasn't shared with them. Getting a share check wrong is the failure that matters most.
- A viewer changes anything, through the UI or by calling the API directly.
- The owner's own experience changes: counts, Trash, budget totals, ordering, locks.
- The share dialog reveals whether an email address has a Daybook account.

## Approaches

- **A. Shared people act on the owner's data (picked).** A `space_shares` table holds the grants. Each controller first asks one access service "can this user read or edit this space?" and gets the owner's id back. It then calls the existing services with that id. The services and their owner-scoped queries stay as they are, and rows a shared editor creates belong to the owner. Cost: no record of who changed what. Routes keyed by a row id need a lookup to find that row's space.
- **B. Membership checks inside every query.** Rewrite each owner-scoped query (about 86 of them across every tool) to join through the shares and check the role there. Rows record their real creator. This was rejected because it's several times the work and has many more places where a missed check would leak data.
- Postgres row-level security was not considered. The project doesn't use it, and moving to it would be a rewrite.

The owner picked A.

## Design

### Data

There is a new table, `space_shares`:

- `id`, `spaceId` (the shared space or folder, cascade on delete), `ownerId` (cascade on user delete), `email` (lowercased), `role` (`'edit' | 'view'` enum) and `createdAt`.
- There is a unique index on `(spaceId, email)` and an index on `email`.

Shares are keyed by **email, not user id** (**my call**). This lets an invite to an address with no account yet start working as soon as that person signs up, and it means the dialog never has to say whether the account exists (an anti-goal). Sign-up already requires a verified email, and changing email isn't supported, so a user's email is a stable key. Inviting your own email is rejected.

### Who can access what

- A share on a folder covers every space in it. A share on a space covers its nested spaces. Both include spaces added later. Access is worked out by walking a space's `parentId` chain up to the root and looking for a share on any ancestor, or on the space itself, for the user's email.
- If more than one share applies (a folder share and a share on a space inside it), the higher role wins.
- A soft-deleted space, or one whose ancestor is deleted, is never accessible to a recipient.
- A Vault space inside a shared folder stays hidden from the recipient, and `resolve` refuses it (**my call**).
- Every space id or row id a request carries, whether in the route, the query or the body (for example a target `spaceId` or an `accountId` inside an entry), is resolved against the same owner. A request that mixes ids from different owners is refused (**my call**).
- Tasks can't be copied between spaces that have different owners. The "Copy to" menu in `TaskRowMenuComponent` only lists spaces with the same owner as the task, and `POST /tasks/:id/copy` rejects any other target (**my call**).

### Server: `SpaceAccessService`

This service lives in `features/spaces` and is exported through the barrel.

- `resolve(userId, spaceId, need: 'view' | 'edit') → { ownerId, role: 'owner' | 'edit' | 'view' }`
  - If the user owns the space, it returns `role: 'owner'`.
  - Otherwise it checks the shares as above.
  - It throws `NotFoundException` when the user has no access at all, so a space that isn't yours looks the same as one that doesn't exist. It throws `ForbiddenException` when the user can view but `need` is `'edit'`.
- `resolveRow(userId, table, rowId, need)` is for routes keyed by a task, page, entry or similar id. It reads the row's `spaceId` and then calls `resolve`. Tables without a `spaceId` column (`notebook_page_versions`, `budget_receipts`, `fitness_food_servings`, goal contributions and any similar ones) resolve through their parent row.
- Built-in fitness foods and exercises are unchanged. They have no space and stay readable by everyone.

### Server: controllers

- Every controller route that takes a space or row resolves access first, then passes `ownerId` instead of `userId` to the existing service.
  - Reads need `'view'`.
  - Anything that writes needs `'edit'`, including AI routes that save, and AI routes that only read but spend the AI quota (my call: AI needs edit).
- `TasksController`, `NotebookController`, `BudgetController`, `FitnessController`, `JobsController` and `DiagramsController` all change. `VaultController` and `TrashController` stay owner-only.
- Owner-only routes in `SpacesController` and `SpaceLockController` stay owner-only: create, order, carry-over, parent, rename, duplicate, delete, setting or removing a lock, and sharing.
- `SpaceLockService` changes:
  - `assertUnlocked` and `isOpen` look the space up by the owner's id.
  - The unlock cookie stays signed with the **viewer's** own `userId`.
  - A shared person sees the lock gate and needs the password, like the owner does.
  - `unlock` is allowed for anyone who can view.
- Tests go in the existing controller tests:
  - A non-shared user gets 404 on every route.
  - A viewer gets 403 on every write.
  - An editor's writes land under the owner.

### What an editor can do

The owner decided this. An editor can add, change and remove **items** in every tool, including deleting Budget accounts, categories, entries and jobs. They can't delete, rename, move or duplicate the shared space or folder itself, and they can't share it, lock it or change its settings. A viewer only reads.

### Saving while someone else is editing

Whole-document saves currently replace everything with no check. These are Notebook pages and Book chapters (`usePageAutosave`), the diagram (`useDiagramAutosave`), meal plans, workout templates and workouts. Two people with the same document open would silently overwrite each other. Out-of-date saves are refused (**my call**, until phase two):

- Each of these saves sends the `updatedAt` it last loaded. The service compares it inside the update (`WHERE updated_at = $sent`) and answers **409** when someone else saved in between. Tables that lack `updatedAt` get one in the migration.
- On a 409 the web stops autosaving that document and shows "Changed by someone else" with a **Reload** action. Reloading refetches and drops the stale local copy. It never merges.
- The owner gets the same check. It also protects one person editing in two tabs.
- Shared spaces' queries refetch on window focus (**my call**), so a stale copy is less likely in the first place.
- Phase two (live co-editing) replaces this check for Notebook, Book and Diagram.

Tasks, Budget rows and job edits are small per-field changes, so they keep last-save-wins.

### Server: share routes

These are on `SpacesController`, and all are owner-only:

- `GET /spaces/:id/shares` lists `{ id, email, role }`.
- `POST /spaces/:id/shares` takes `{ email, role }`. It upserts on `(spaceId, email)` and refuses Vault spaces and the owner's own email.
- `PATCH /spaces/:id/shares/:shareId` takes `{ role }`.
- `DELETE /spaces/:id/shares/:shareId` removes a share.
- `DELETE /spaces/:id/shares/me` lets a recipient leave a share made directly to them. A folder share is left from the folder.

### Server: `GET /spaces`

- It returns the user's own spaces as now, each with `access: 'owner'` and `shared: boolean` (true when it has at least one share).
- It also returns the spaces shared with them, roots and their descendants, each with `access: 'edit' | 'view'` and `ownerName`.
- `openToday` counts for shared spaces use the owner's tasks and each space's own `carryOver`, as now.
- The client tells the two lists apart by `access`.

### Web

- **Sidebar.** `SpacesNavComponent` shows **Shared with me** below the user's own spaces. It's grouped as shared folders (with their spaces) followed by directly shared spaces, and each row shows the owner's name in muted text. The section isn't sortable. When nothing is shared, the section is hidden. The user's own shared spaces get a small `Users` icon (lucide).
- **Share dialog.** **Share…** sits in `SpaceContextMenuComponent` and in space settings, for owners only and never for Vault. It's a shadcn `Dialog` with:
  - an email input, a role `Select` (Can edit / Can view) and an **Invite** button
  - then the list of people, each with a role select and a remove button.
  - Its query key is `['space-shares', spaceId]`, and its mutations are optimistic, following the project's usual pattern.
  - Its loading state is a Skullet skeleton of the list.
- **Recipient's context menu.** It shows only **Leave** (for direct shares).
- **Read-only.** A `useSpaceAccess(spaceId)` hook reads `access` from `['spaces']`. When access is `'view'`, each tool hides or disables its editing controls: add, edit, delete, drag, autosave and AI actions. A small "View only" badge shows in the space header. This is the bulk of the web work, done per tool: List, Notebook, Book, Budget, Fitness, Job hunt, Diagram. The server's 403 is the backstop. The web never relies on hiding alone.
- **Cache.** `space-cache.ts` and the space mutations ignore shared spaces in reorder and move logic.

### Docs

- Update the root `CLAUDE.md` with a short "Sharing rules" section covering the access service rule (every route resolves access, services get `ownerId`), email-keyed shares and the Vault exclusion.
- Strike the sharing non-goal in the original spec, with a pointer to this doc.

## Left to the builder

- The exact per-tool read-only treatment (what's hidden and what's disabled), as long as no edit affordance stays active for a viewer.
- How `resolveRow` maps each table to its space, and whether it's one generic helper or a few small ones.
- The migration name, the dialog copy and the empty states.
- Whether `GET /spaces` needs a recursive CTE or an in-memory walk to find shared descendants. An in-memory walk over the owners' space rows is fine at this scale.
