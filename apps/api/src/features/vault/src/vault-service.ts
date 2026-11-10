import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, vaultItems, vaults } from '../../../shared/db/schema.ts';
import type {
  CreateItemInput,
  ImportItemsInput,
  ItemPayload,
  PasscodeWrap,
  RecoveryWrap,
  VaultDto,
} from './vault-schemas.ts';

export type VaultItemDto = ItemPayload & { id: string; updatedAt: string };

@Injectable()
export class VaultService {
  constructor(@Inject(DB) private readonly db: Db) {}

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

  async erase(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(vaultItems).where(eq(vaultItems.userId, userId));
      await tx.delete(vaults).where(eq(vaults.userId, userId));
    });
  }

  async listItems(userId: string, spaceId: string): Promise<VaultItemDto[]> {
    await this.assertVaultSpace(userId, spaceId);
    const rows = await this.db
      .select()
      .from(vaultItems)
      .where(and(eq(vaultItems.userId, userId), eq(vaultItems.spaceId, spaceId), isNull(vaultItems.deletedAt)))
      .orderBy(desc(vaultItems.updatedAt), desc(vaultItems.id));
    return rows.map(({ id, iv, ciphertext, updatedAt }) => ({ id, iv, ciphertext, updatedAt: updatedAt.toISOString() }));
  }

  async createItem(userId: string, input: CreateItemInput): Promise<void> {
    await this.assertVaultSpace(userId, input.spaceId);
    await this.db.insert(vaultItems).values({ ...input, userId });
  }

  async updateItem(userId: string, id: string, payload: ItemPayload): Promise<void> {
    const updated = await this.db
      .update(vaultItems)
      .set({ ...payload, updatedAt: new Date() })
      .where(this.ownedItem(userId, id))
      .returning({ id: vaultItems.id });
    if (updated.length === 0) throw new NotFoundException('Item not found');
  }

  async removeItem(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .update(vaultItems)
      .set({ deletedAt: new Date() })
      .where(this.ownedItem(userId, id))
      .returning({ id: vaultItems.id });
    if (deleted.length === 0) throw new NotFoundException('Item not found');
  }

  async importItems(userId: string, { spaceId, items }: ImportItemsInput): Promise<void> {
    await this.assertVaultSpace(userId, spaceId);
    if (items.length > 0) await this.db.insert(vaultItems).values(items.map((item) => ({ ...item, userId, spaceId })));
  }

  private async updateVault(userId: string, changes: PasscodeWrap | RecoveryWrap): Promise<void> {
    const updated = await this.db
      .update(vaults)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(vaults.userId, userId))
      .returning({ userId: vaults.userId });
    if (updated.length === 0) throw new NotFoundException('Vault not found');
  }

  private ownedItem(userId: string, id: string) {
    return and(eq(vaultItems.id, id), eq(vaultItems.userId, userId), isNull(vaultItems.deletedAt));
  }

  private async assertVaultSpace(userId: string, spaceId: string): Promise<void> {
    const [vault] = await this.db.select({ userId: vaults.userId }).from(vaults).where(eq(vaults.userId, userId));
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(
        and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'vault'), isNull(spaces.deletedAt)),
      );
    if (!vault || !space) throw new NotFoundException('Vault not found');
  }
}
