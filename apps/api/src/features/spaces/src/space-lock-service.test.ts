import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { TrashService } from '../../trash/src/trash-service.ts';
import { readCookies, SpaceLockService, unlockCookieName } from './space-lock-service.ts';
import { SpaceAccessService } from './space-access-service.ts';
import { SpacesService } from './spaces-service.ts';

describe('SpaceLockService', () => {
  let db: Db;
  let lock: SpaceLockService;
  let notebook: string;

  const addSpace = async (tool: 'notebook' | 'vault' | 'list', userId = 'u1') => {
    const [row] = await db.insert(spaces).values({ userId, kind: 'space', title: 'Diary', tool }).returning();
    return row.id;
  };
  const cookie = (spaceId: string, token: string) => `other=1; ${unlockCookieName(spaceId)}=${token}`;
  const isOpen = (token: string, userId = 'u1') => lock.isOpen(userId, notebook, cookie(notebook, token));

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
  });

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    await insertUser(db, 'u2');
    lock = new SpaceLockService(db);
    notebook = await addSpace('notebook');
  });

  it('leaves a space without a password open', async () => {
    expect(await lock.isOpen('u1', notebook, undefined)).toBe(true);
    await expect(lock.assertUnlocked('u1', notebook, undefined)).resolves.toBeUndefined();
  });

  it('locks a space until the right password unlocks it', async () => {
    const afterSetting = await lock.setPassword('u1', notebook, 'secret');
    expect(await isOpen(afterSetting)).toBe(true);
    expect(await lock.isOpen('u1', notebook, undefined)).toBe(false);
    await expect(lock.assertUnlocked('u1', notebook, undefined)).rejects.toThrow(ForbiddenException);
    await expect(lock.unlock('u1', notebook, 'wrong')).rejects.toThrow(ForbiddenException);
    expect(await isOpen(await lock.unlock('u1', notebook, 'secret'))).toBe(true);
  });

  it('does not accept a forged, expired or borrowed unlock', async () => {
    const token = await lock.setPassword('u1', notebook, 'secret');
    const [expires] = token.split('.');
    expect(await isOpen(`${Number(expires) + 1000}.${token.split('.')[1]}`)).toBe(false);
    expect(await isOpen('garbage')).toBe(false);
    await db.insert(spaces).values({ id: crypto.randomUUID(), userId: 'u2', kind: 'space', title: 'x', tool: 'list' });
    await expect(lock.isOpen('u2', notebook, cookie(notebook, token))).rejects.toThrow();
    vi.useFakeTimers({ now: Date.now() + 13 * 60 * 60 * 1000 });
    expect(await isOpen(token)).toBe(false);
    vi.useRealTimers();
  });

  it('needs the current password to change it, and the change ends earlier unlocks', async () => {
    const old = await lock.setPassword('u1', notebook, 'secret');
    await expect(lock.setPassword('u1', notebook, 'newer')).rejects.toThrow(ForbiddenException);
    const fresh = await lock.setPassword('u1', notebook, 'newer', 'secret');
    expect(await isOpen(old)).toBe(false);
    expect(await isOpen(fresh)).toBe(true);
  });

  it('removes the password with the password, or by reset after an account check', async () => {
    await lock.setPassword('u1', notebook, 'secret');
    await expect(lock.removePassword('u1', notebook, 'wrong')).rejects.toThrow(ForbiddenException);
    await lock.removePassword('u1', notebook, 'secret');
    expect(await lock.isOpen('u1', notebook, undefined)).toBe(true);
    await lock.setPassword('u1', notebook, 'again');
    await lock.resetPassword('u1', notebook);
    expect(await lock.isOpen('u1', notebook, undefined)).toBe(true);
  });

  it('refuses vault spaces', async () => {
    await expect(lock.setPassword('u1', await addSpace('vault'), 'secret')).rejects.toThrow(BadRequestException);
  });

  it('shows whether a space is locked and keeps the lock on a copy', async () => {
    await lock.setPassword('u1', notebook, 'secret');
    const service = new SpacesService(db, new SpaceAccessService(db));
    const copy = await service.duplicate('u1', notebook);
    expect(copy.locked).toBe(true);
    expect((await service.list('u1', '2026-11-12')).every((space) => space.locked)).toBe(true);
    expect(await lock.isOpen('u1', copy.id, undefined)).toBe(false);
  });

  it('hides titles in Trash from a locked space until it is unlocked', async () => {
    const list = await addSpace('list');
    const token = await lock.setPassword('u1', list, 'secret');
    const { tasks } = await import('../../../shared/db/schema.ts');
    await db.insert(tasks).values({ userId: 'u1', spaceId: list, title: 'Private plan', plannedDay: '2026-11-12', deletedAt: new Date() });
    const trash = new TrashService(db);
    const titles = async (cookies: Map<string, string>) =>
      (await trash.list('u1', (space) => lock.isUnlocked('u1', space, cookies))).map((item) => item.title);
    expect(await titles(new Map())).toEqual(['Hidden while its space is locked']);
    expect(await titles(readCookies(cookie(list, token)))).toEqual(['Private plan']);
  });
});
