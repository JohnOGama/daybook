# Sharing rules

## Sharing rules

- `space_shares` rows are keyed by lowercased email, so an invite works before the person signs up. A share on a folder or space covers everything under it, the best role wins, and a deleted ancestor hides the share. Vault is never shared.
- Every space-content route calls `SpaceAccessService` (`resolve`, `resolveRow`, `resolveRows`) first and passes the returned `ownerId` to the unchanged services. No access is 404; view-only on a write is 403; AI routes need edit. Trash, Vault and the owner-only space routes (rename, delete, move, duplicate) answer 404 to recipients. `resolveRow` does not check `deletedAt`, so keep the live-row check.
- `SpaceLockService` looks up by space id only, so callers resolve access first. The unlock cookie is signed with the viewer's own user id, recipients need the password, and only the owner can reset or remove it.
- Whole-document saves (notebook page content, meal plans, workout templates, workouts) carry a `version` integer. A stale one answers 409 "Changed by someone else", and editors send the version they opened with; the web offers Reload.
- Share routes are on `SpacesController` (`/spaces/:id/shares`, plus `/shares/me` to leave). The web `Space` has `access`, `shared`, `ownerId` and `ownerName`; read access through `useSpaceAccess()` (`access`, `canEdit`, `isOwner`). Every tool hides edit controls and automatic writes (budget schedule catch-up, diagram table placement) for viewers.
