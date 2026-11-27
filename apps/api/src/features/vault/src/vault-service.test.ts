import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces, spaceShares, vaultItems, vaultSpaceKeys } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { VaultService } from './vault-service.ts';

const b64 = (bytes: number, fill: number) => Buffer.alloc(bytes, fill).toString('base64');
const material = {
  salt: b64(16, 1),
  iterations: 600_000,
  wrappedKey: b64(60, 2),
  recoverySalt: b64(16, 3),
  recoveryWrappedKey: b64(60, 4),
};
const otherSalt = b64(16, 7);
const otherWrap = b64(60, 8);
const iv = b64(12, 5);
const ciphertext = b64(32, 6);

describe('VaultService', () => {
  let db: Db;
  let svc: VaultService;
  let mine: string;
  let theirs: string;
  let notebookSpace: string;
  const newId = () => crypto.randomUUID();

  const addSpace = async (userId: string, tool: 'vault' | 'notebook') => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'S', tool }).returning();
    return row.id;
  };

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    svc = new VaultService(db, new SpaceAccessService(db));
    mine = await addSpace('u1', 'vault');
    theirs = await addSpace('u2', 'vault');
    notebookSpace = await addSpace('u1', 'notebook');
  });

  it('stores and returns a vault', async () => {
    await svc.create('u1', material);
    expect(await svc.get('u1')).toEqual(material);
    expect(await svc.get('u2')).toBeNull();
  });

  it('refuses a second vault and keeps the first', async () => {
    await svc.create('u1', material);
    await expect(svc.create('u1', { ...material, salt: otherSalt })).rejects.toThrow(ConflictException);
    expect((await svc.get('u1'))?.salt).toBe(material.salt);
  });

  it('changes only the passcode wrap', async () => {
    await svc.create('u1', material);
    await svc.setPasscode('u1', { salt: otherSalt, iterations: 700_000, wrappedKey: otherWrap });
    expect(await svc.get('u1')).toMatchObject({
      salt: otherSalt,
      iterations: 700_000,
      wrappedKey: otherWrap,
      recoverySalt: material.recoverySalt,
    });
  });

  it('changes only the recovery wrap', async () => {
    await svc.create('u1', material);
    await svc.setRecovery('u1', { recoverySalt: otherSalt, recoveryWrappedKey: otherWrap });
    expect(await svc.get('u1')).toMatchObject({ salt: material.salt, recoverySalt: otherSalt });
  });

  it('refuses to change a vault that does not exist', async () => {
    await expect(svc.setPasscode('u1', { salt: otherSalt, iterations: 600_000, wrappedKey: otherWrap })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lists items newest change first and hides deleted ones', async () => {
    await svc.create('u1', material);
    const [a, b] = [newId(), newId()];
    await svc.createItem('u1', { id: a, spaceId: mine, iv, ciphertext });
    await svc.createItem('u1', { id: b, spaceId: mine, iv, ciphertext });
    await db.update(vaultItems).set({ updatedAt: new Date(0) });
    await svc.updateItem('u1', a, { iv, ciphertext: b64(40, 9) });
    expect(await svc.listItems('u1', mine)).toMatchObject([{ id: a, iv, ciphertext: b64(40, 9) }, { id: b }]);
    await svc.removeItem('u1', b);
    expect((await svc.listItems('u1', mine)).map((row) => row.id)).toEqual([a]);
  });

  it("keeps people out of each other's vaults", async () => {
    await svc.create('u1', material);
    await svc.create('u2', material);
    const id = newId();
    await svc.createItem('u1', { id, spaceId: mine, iv, ciphertext });
    await expect(svc.listItems('u2', mine)).rejects.toThrow(NotFoundException);
    await expect(svc.createItem('u1', { id: newId(), spaceId: theirs, iv, ciphertext })).rejects.toThrow(NotFoundException);
    await expect(svc.updateItem('u2', id, { iv, ciphertext })).rejects.toThrow(NotFoundException);
    await expect(svc.removeItem('u2', id)).rejects.toThrow(NotFoundException);
    await expect(svc.importItems('u1', { spaceId: theirs, items: [{ id: newId(), iv, ciphertext }] })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses items in a space that is not a vault', async () => {
    await svc.create('u1', material);
    await expect(svc.createItem('u1', { id: newId(), spaceId: notebookSpace, iv, ciphertext })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses items before a vault is set up', async () => {
    await expect(svc.createItem('u1', { id: newId(), spaceId: mine, iv, ciphertext })).rejects.toThrow(NotFoundException);
  });

  it('imports all items or none', async () => {
    await svc.create('u1', material);
    const [existing, fresh] = [newId(), newId()];
    await svc.createItem('u1', { id: existing, spaceId: mine, iv, ciphertext });
    await expect(
      svc.importItems('u1', {
        spaceId: mine,
        items: [
          { id: fresh, iv, ciphertext },
          { id: existing, iv, ciphertext },
        ],
      }),
    ).rejects.toThrow();
    expect((await svc.listItems('u1', mine)).map((row) => row.id)).toEqual([existing]);
  });

  it('imports new items', async () => {
    await svc.create('u1', material);
    const [a, b] = [newId(), newId()];
    await svc.importItems('u1', {
      spaceId: mine,
      items: [
        { id: a, iv, ciphertext },
        { id: b, iv, ciphertext },
      ],
    });
    expect((await svc.listItems('u1', mine)).map((row) => row.id).sort()).toEqual([a, b].sort());
  });

  it('erases one person only, including trashed items', async () => {
    await svc.create('u1', material);
    await svc.create('u2', material);
    const [kept, trashed] = [newId(), newId()];
    await svc.createItem('u1', { id: kept, spaceId: mine, iv, ciphertext });
    await svc.createItem('u1', { id: trashed, spaceId: mine, iv, ciphertext });
    await svc.createItem('u2', { id: newId(), spaceId: theirs, iv, ciphertext });
    await svc.removeItem('u1', trashed);

    await svc.erase('u1');

    expect(await svc.get('u1')).toBeNull();
    expect(await db.select().from(vaultItems).where(eq(vaultItems.userId, 'u1'))).toEqual([]);
    expect(await svc.get('u2')).not.toBeNull();
    expect(await svc.listItems('u2', theirs)).toHaveLength(1);
  });

  describe('sharing', () => {
    const wrap = { salt: b64(16, 9), iterations: 600_000, wrappedKey: b64(60, 10), ownerWrappedKey: b64(60, 11) };
    const share = (role: 'view' | 'edit') =>
      db.insert(spaceShares).values({ id: newId(), spaceId: mine, ownerId: 'u1', email: 'u2@example.com', role });

    beforeEach(() => svc.create('u1', material));

    it('hides a shared vault until it has a sharing passcode', async () => {
      await share('view');
      await expect(svc.listItems('u2', mine)).rejects.toThrow(NotFoundException);
      await svc.setSpaceKey('u1', mine, { ...wrap, items: [] });
      expect(await svc.listItems('u2', mine)).toEqual([]);
    });

    it('re-encrypts every item, trashed ones too, when the passcode is first set', async () => {
      const live = newId();
      const trashed = newId();
      await svc.createItem('u1', { id: live, spaceId: mine, iv, ciphertext });
      await svc.createItem('u1', { id: trashed, spaceId: mine, iv, ciphertext });
      await svc.removeItem('u1', trashed);
      expect(await svc.listItems('u1', mine, true)).toHaveLength(2);
      const fresh = b64(32, 12);
      await expect(svc.setSpaceKey('u1', mine, { ...wrap, items: [{ id: live, iv, ciphertext: fresh }] })).rejects.toThrow(ConflictException);
      expect(await db.select().from(vaultSpaceKeys)).toEqual([]);
      await svc.setSpaceKey('u1', mine, { ...wrap, items: [live, trashed].map((id) => ({ id, iv, ciphertext: fresh })) });
      const rows = await db.select().from(vaultItems).where(eq(vaultItems.spaceId, mine));
      expect(rows.map((row) => row.ciphertext)).toEqual([fresh, fresh]);
    });

    it('only re-wraps after that, and only for the owner', async () => {
      await svc.setSpaceKey('u1', mine, { ...wrap, items: [] });
      await expect(svc.setSpaceKey('u1', mine, { ...wrap, items: [] })).rejects.toThrow(BadRequestException);
      await svc.setSpaceKey('u1', mine, { ...wrap, salt: otherSalt });
      expect((await svc.spaceKey('u1', mine))?.salt).toBe(otherSalt);
      await share('edit');
      await expect(svc.setSpaceKey('u2', mine, wrap)).rejects.toThrow(ForbiddenException);
    });

    it('lets editors write under the owner, viewers only read, and keeps the owner wrap for the owner', async () => {
      await svc.setSpaceKey('u1', mine, { ...wrap, items: [] });
      await share('view');
      expect(await svc.spaceKey('u2', mine)).toEqual({ salt: wrap.salt, iterations: wrap.iterations, wrappedKey: wrap.wrappedKey });
      expect((await svc.spaceKey('u1', mine))?.ownerWrappedKey).toBe(wrap.ownerWrappedKey);
      await expect(svc.createItem('u2', { id: newId(), spaceId: mine, iv, ciphertext })).rejects.toThrow(ForbiddenException);
      await db.update(spaceShares).set({ role: 'edit' });
      const id = newId();
      await svc.createItem('u2', { id, spaceId: mine, iv, ciphertext });
      await svc.updateItem('u2', id, { iv, ciphertext: b64(32, 13) });
      const [row] = await db.select().from(vaultItems).where(eq(vaultItems.id, id));
      expect(row.userId).toBe('u1');
      await svc.removeItem('u2', id);
      expect(await svc.listItems('u2', mine, true)).toEqual([]);
    });

    it('stops sharing when the owner erases their vault', async () => {
      await svc.setSpaceKey('u1', mine, { ...wrap, items: [] });
      await share('view');
      await svc.erase('u1');
      expect(await db.select().from(vaultSpaceKeys)).toEqual([]);
      await expect(svc.spaceKey('u2', mine)).rejects.toThrow(NotFoundException);
    });
  });
});
