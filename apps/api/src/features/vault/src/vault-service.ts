import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, vaultItems, vaults, vaultSpaceKeys } from '../../../shared/db/schema.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import type {
  CreateItemInput,
  ImportItemsInput,
  ItemPayload,
  PasscodeWrap,
  RecoveryWrap,
  SpaceKeyInput,
  VaultDto,
} from './vault-schemas.ts';

export type VaultItemDto = ItemPayload & { id: string; updatedAt: string };
// `ownerWrappedKey` only goes to the owner; everyone else opens the space key with the sharing passcode.
export type SpaceKeyDto = PasscodeWrap & { ownerWrappedKey?: string };

const notFound = () => new NotFoundException('Vault not found');

@Injectable()
export class VaultService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
  ) {}

  async get(userId: string): Promise<VaultDto | null> {
    const [row] = await this.db.select().from(vaults).where(eq(vaults.userId, userId));
    if (!row) return null;
    const { salt, iterations, wrappedKey, recoverySalt, recoveryWrappedKey } = row;
    return { salt, iterations, wrappedKey, recoverySalt, recoveryWrappedKey };
  }

  async create(userId: string, material: VaultDto): Promise<void> {
    const created = await this.db
      .insert(vaults)
      .values({ ...material, userId })
      .onConflictDoNothing()
      .returning({ userId: vaults.userId });
    if (created.length === 0) throw new ConflictException('A vault already exists');
  }

  setPasscode(userId: string, wrap: PasscodeWrap): Promise<void> {
    return this.updateVault(userId, wrap);
  }

  setRecovery(userId: string, wrap: RecoveryWrap): Promise<void> {
    return this.updateVault(userId, wrap);
  }

  // Erasing also drops the sharing keys of the owner's Vaults, since they were wrapped with the erased vault key, so
  // those Vaults stop being shared.
  async erase(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const owned = tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.userId, userId));
      await tx.delete(vaultSpaceKeys).where(inArray(vaultSpaceKeys.spaceId, owned));
      await tx.delete(vaultItems).where(eq(vaultItems.userId, userId));
      await tx.delete(vaults).where(eq(vaults.userId, userId));
    });
  }

  async spaceKey(userId: string, spaceId: string): Promise<SpaceKeyDto | null> {
    const { ownerId } = await this.vaultSpace(userId, spaceId, 'view');
    const [row] = await this.db.select().from(vaultSpaceKeys).where(eq(vaultSpaceKeys.spaceId, spaceId));
    if (!row) return null;
    const { salt, iterations, wrappedKey, ownerWrappedKey } = row;
    return ownerId === userId ? { salt, iterations, wrappedKey, ownerWrappedKey } : { salt, iterations, wrappedKey };
  }

  // The owner sets the sharing passcode. The first time, every item in the space (trashed ones too) comes back
  // re-encrypted with the new space key, all of them or nothing. After that it only re-wraps the key.
  async setSpaceKey(userId: string, spaceId: string, { items, ...wrap }: SpaceKeyInput): Promise<void> {
    const { access } = await this.vaultSpace(userId, spaceId, 'edit');
    if (access !== 'owner') throw new ForbiddenException('Only the owner can set the sharing passcode');
    await this.db.transaction(async (tx) => {
      // ponytail: locks the space row so a key and its re-encrypted items land together; an item saved by another tab
      // mid-setup with the old key would be refused only by this check, not merged.
      await tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.id, spaceId)).for('update');
      const [existing] = await tx.select({ id: vaultSpaceKeys.spaceId }).from(vaultSpaceKeys).where(eq(vaultSpaceKeys.spaceId, spaceId));
      if (existing) {
        if (items) throw new BadRequestException('This vault already has a sharing passcode');
        await tx.update(vaultSpaceKeys).set({ ...wrap, updatedAt: new Date() }).where(eq(vaultSpaceKeys.spaceId, spaceId));
        return;
      }
      if (!items) throw new BadRequestException('Send every item re-encrypted with the new key');
      const stored = await tx.select({ id: vaultItems.id }).from(vaultItems).where(eq(vaultItems.spaceId, spaceId));
      const sent = new Set(items.map((item) => item.id));
      if (stored.length !== sent.size || stored.some(({ id }) => !sent.has(id))) {
        throw new ConflictException('This vault changed while it was being set up. Try again.');
      }
      await tx.insert(vaultSpaceKeys).values({ spaceId, ...wrap });
      for (const { id, iv, ciphertext } of items) {
        await tx.update(vaultItems).set({ iv, ciphertext }).where(eq(vaultItems.id, id));
      }
    });
  }

  async listItems(userId: string, spaceId: string, includeDeleted = false): Promise<VaultItemDto[]> {
    const { ownerId, access } = await this.vaultSpace(userId, spaceId, 'view');
    const rows = await this.db
      .select()
      .from(vaultItems)
      .where(
        and(
          eq(vaultItems.userId, ownerId),
          eq(vaultItems.spaceId, spaceId),
          includeDeleted && access === 'owner' ? undefined : isNull(vaultItems.deletedAt),
        ),
      )
      .orderBy(desc(vaultItems.updatedAt), desc(vaultItems.id));
    return rows.map(({ id, iv, ciphertext, updatedAt }) => ({ id, iv, ciphertext, updatedAt: updatedAt.toISOString() }));
  }

  async createItem(userId: string, input: CreateItemInput): Promise<void> {
    const { ownerId } = await this.vaultSpace(userId, input.spaceId, 'edit');
    await this.db.insert(vaultItems).values({ ...input, userId: ownerId });
  }

  async updateItem(userId: string, id: string, payload: ItemPayload): Promise<void> {
    const ownerId = await this.itemOwner(userId, id);
    const updated = await this.db
      .update(vaultItems)
      .set({ ...payload, updatedAt: new Date() })
      .where(this.liveItem(ownerId, id))
      .returning({ id: vaultItems.id });
    if (updated.length === 0) throw new NotFoundException('Item not found');
  }

  async removeItem(userId: string, id: string): Promise<void> {
    const ownerId = await this.itemOwner(userId, id);
    const deleted = await this.db
      .update(vaultItems)
      .set({ deletedAt: new Date() })
      .where(this.liveItem(ownerId, id))
      .returning({ id: vaultItems.id });
    if (deleted.length === 0) throw new NotFoundException('Item not found');
  }

  async importItems(userId: string, { spaceId, items }: ImportItemsInput): Promise<void> {
    const { ownerId } = await this.vaultSpace(userId, spaceId, 'edit');
    if (items.length > 0) await this.db.insert(vaultItems).values(items.map((item) => ({ ...item, userId: ownerId, spaceId })));
  }

  private async updateVault(userId: string, changes: PasscodeWrap | RecoveryWrap): Promise<void> {
    const updated = await this.db
      .update(vaults)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(vaults.userId, userId))
      .returning({ userId: vaults.userId });
    if (updated.length === 0) throw new NotFoundException('Vault not found');
  }

  private liveItem(ownerId: string, id: string) {
    return and(eq(vaultItems.id, id), eq(vaultItems.userId, ownerId), isNull(vaultItems.deletedAt));
  }

  private async itemOwner(userId: string, id: string): Promise<string> {
    const [row] = await this.db.select({ spaceId: vaultItems.spaceId }).from(vaultItems).where(eq(vaultItems.id, id));
    if (!row) throw new NotFoundException('Item not found');
    return (await this.vaultSpace(userId, row.spaceId, 'edit').catch(() => {
      throw new NotFoundException('Item not found');
    })).ownerId;
  }

  // A Vault space the person may use, and its owner's vault. Someone it is shared with only gets this far once it has
  // a sharing passcode (`SpaceAccessService` hides it until then).
  private async vaultSpace(userId: string, spaceId: string, need: 'view' | 'edit') {
    const resolved = await this.access.resolve(userId, spaceId, need).catch((error: unknown) => {
      throw error instanceof ForbiddenException ? error : notFound();
    });
    const [space] = await this.db.select({ tool: spaces.tool }).from(spaces).where(eq(spaces.id, spaceId));
    const [vault] = await this.db.select({ userId: vaults.userId }).from(vaults).where(eq(vaults.userId, resolved.ownerId));
    if (space?.tool !== 'vault' || !vault) throw notFound();
    return resolved;
  }
}
