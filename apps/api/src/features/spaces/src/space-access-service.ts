import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type AnyPgColumn, alias, type PgTable } from 'drizzle-orm/pg-core';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { type ShareRole, spaces, spaceShares, user, vaultSpaceKeys } from '../../../shared/db/schema.ts';

export type Access = 'owner' | 'edit' | 'view';
export type Need = 'view' | 'edit';
export type Resolved = { ownerId: string; access: Access; spaceId: string };
export type SpaceRow = typeof spaces.$inferSelect;
export type SharedSpace = { row: SpaceRow; access: ShareRole; ownerName: string };
type SpaceScoped = PgTable & { id: AnyPgColumn; spaceId: AnyPgColumn; userId: AnyPgColumn };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new NotFoundException('Space not found');
const owner = alias(user, 'owner');
const bestRole = (roles: ShareRole[]): ShareRole | undefined => (roles.includes('edit') ? 'edit' : roles[0]);

// Decides who may see or change a space. No access looks exactly like a missing space (404).
@Injectable()
export class SpaceAccessService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async resolve(userId: string, spaceId: string, need: Need): Promise<Resolved> {
    if (!UUID.test(spaceId)) throw notFound();
    const [space] = await this.db.select().from(spaces).where(and(eq(spaces.id, spaceId), isNull(spaces.deletedAt)));
    if (!space) throw notFound();
    if (space.userId === userId) return { ownerId: userId, access: 'owner', spaceId };

    const chain = await this.chain(space);
    const roles = await this.db
      .select({ role: spaceShares.role })
      .from(spaceShares)
      .innerJoin(user, eq(user.id, userId))
      .where(
        and(
          inArray(spaceShares.spaceId, chain.map((s) => s.id)),
          eq(spaceShares.ownerId, space.userId),
          eq(spaceShares.email, sql`lower(${user.email})`),
        ),
      );
    const role = bestRole(roles.map((r) => r.role));
    if (!role) throw notFound();
    if (need === 'edit' && role === 'view') throw new ForbiddenException('You can only view this space');
    return { ownerId: space.userId, access: role, spaceId };
  }

  async resolveRow(userId: string, table: SpaceScoped, rowId: string, need: Need): Promise<Resolved> {
    return this.resolveRows(userId, table, [rowId], need);
  }

  async resolveRows(userId: string, table: SpaceScoped, rowIds: string[], need: Need): Promise<Resolved> {
    const ids = [...new Set(rowIds)];
    if (ids.length === 0 || !ids.every((id) => UUID.test(id))) throw notFound();
    const rows = (await this.db
      .select({ spaceId: table.spaceId })
      .from(table as PgTable)
      .where(inArray(table.id, ids))) as { spaceId: string | null }[];
    if (rows.length !== ids.length || rows.some((r) => !r.spaceId)) throw notFound();

    const resolved: Resolved[] = [];
    for (const spaceId of new Set(rows.map((r) => r.spaceId as string))) {
      resolved.push(await this.resolve(userId, spaceId, need));
    }
    if (resolved.some((r) => r.ownerId !== resolved[0].ownerId)) throw notFound();
    return resolved[0];
  }

  // Everyone who may see the space right now: its owner and the signed-up people it, or a folder above it, is shared with.
  // The reverse of `resolve`, with the same rules: a deleted ancestor, or a Vault with no sharing passcode, hides it.
  async viewerIds(spaceId: string): Promise<string[]> {
    const [space] = await this.db.select().from(spaces).where(and(eq(spaces.id, spaceId), isNull(spaces.deletedAt)));
    if (!space) return [];
    const chain = await this.chain(space).catch(() => null);
    if (!chain) return [];
    const recipients = await this.db
      .selectDistinct({ id: user.id })
      .from(spaceShares)
      .innerJoin(user, eq(spaceShares.email, sql`lower(${user.email})`))
      .where(and(inArray(spaceShares.spaceId, chain.map((s) => s.id)), eq(spaceShares.ownerId, space.userId)));
    return [...new Set([space.userId, ...recipients.map((r) => r.id)])];
  }

  async sharedWith(userId: string): Promise<SharedSpace[]> {
    const shares = await this.db
      .select({ spaceId: spaceShares.spaceId, ownerId: spaceShares.ownerId, role: spaceShares.role, ownerName: owner.name })
      .from(spaceShares)
      .innerJoin(user, eq(user.id, userId))
      .innerJoin(owner, eq(owner.id, spaceShares.ownerId))
      .where(and(eq(spaceShares.email, sql`lower(${user.email})`), sql`${spaceShares.ownerId} <> ${userId}`));
    if (shares.length === 0) return [];

    // ponytail: loads every live space of each sharing owner and walks it in memory; fine at personal scale.
    const ownerSpaces = await this.db
      .select()
      .from(spaces)
      .where(and(inArray(spaces.userId, [...new Set(shares.map((s) => s.ownerId))]), isNull(spaces.deletedAt)));
    const byId = new Map(ownerSpaces.map((s) => [s.id, s]));
    const children = new Map<string, SpaceRow[]>();
    for (const s of ownerSpaces) if (s.parentId) children.set(s.parentId, [...(children.get(s.parentId) ?? []), s]);

    // A Vault is shared only once its owner has set a sharing passcode for it.
    const vaultIds = ownerSpaces.filter((s) => s.tool === 'vault').map((s) => s.id);
    const keyed = new Set(
      vaultIds.length === 0
        ? []
        : (await this.db.select({ id: vaultSpaceKeys.spaceId }).from(vaultSpaceKeys).where(inArray(vaultSpaceKeys.spaceId, vaultIds))).map((k) => k.id),
    );

    const found = new Map<string, SharedSpace>();
    for (const share of shares) {
      const root = byId.get(share.spaceId);
      if (!root || root.userId !== share.ownerId || !this.liveAncestors(root, byId)) continue;
      const stack = [root];
      while (stack.length > 0) {
        const space = stack.pop() as SpaceRow;
        if (space.tool === 'vault' && !keyed.has(space.id)) continue;
        const seen = found.get(space.id);
        if (seen?.access === 'edit' || seen?.access === share.role) continue;
        found.set(space.id, { row: space, access: share.role, ownerName: share.ownerName });
        stack.push(...(children.get(space.id) ?? []));
      }
    }

    return [...found.values()].map((shared) =>
      shared.row.parentId && !found.has(shared.row.parentId) ? { ...shared, row: { ...shared.row, parentId: null } } : shared,
    );
  }

  // The space and its ancestors up to the root. A deleted or missing ancestor, a Vault above it, or a Vault with no
  // sharing passcode hides it.
  private async chain(space: SpaceRow): Promise<SpaceRow[]> {
    if (space.tool === 'vault') {
      const [key] = await this.db.select({ id: vaultSpaceKeys.spaceId }).from(vaultSpaceKeys).where(eq(vaultSpaceKeys.spaceId, space.id));
      if (!key) throw notFound();
    }
    const chain = [space];
    for (let current = space; current.parentId; ) {
      if (chain.length > 32) throw notFound();
      const [parent] = await this.db
        .select()
        .from(spaces)
        .where(and(eq(spaces.id, current.parentId), eq(spaces.userId, space.userId), isNull(spaces.deletedAt)));
      if (!parent) throw notFound();
      chain.push(parent);
      current = parent;
    }
    if (chain.slice(1).some((s) => s.tool === 'vault')) throw notFound();
    return chain;
  }

  private liveAncestors(space: SpaceRow, byId: Map<string, SpaceRow>): boolean {
    let current: SpaceRow | undefined = space;
    for (let depth = 0; current?.parentId; depth++) {
      current = byId.get(current.parentId);
      if (!current || current.userId !== space.userId || current.tool === 'vault' || depth > 32) return false;
    }
    return true;
  }
}
