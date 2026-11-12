import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;
const UNLOCK_MS = 12 * 60 * 60 * 1000;

type LockableSpace = { id: string; lockHash: string | null };

export const unlockCookieName = (spaceId: string) => `daybook_unlock_${spaceId}`;

export function readCookies(header: string | undefined): Map<string, string> {
  return new Map(
    (header ?? '').split(';').flatMap((part): [string, string][] => {
      const split = part.indexOf('=');
      return split < 0 ? [] : [[part.slice(0, split).trim(), part.slice(split + 1).trim()]];
    }),
  );
}

export async function hashLockPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

async function matchesLockPassword(password: string, stored: string): Promise<boolean> {
  const [, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}

const sameText = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error('BETTER_AUTH_SECRET is not set');
  return value;
}

// A space password is enforced here, not in the browser: locked content is only served with a valid unlock cookie.
// ponytail: no attempt limit beyond scrypt's cost; add one with the auth rate limiting before deploying.
@Injectable()
export class SpaceLockService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // The signature covers the password hash, so changing or removing the password ends every unlock.
  private sign(userId: string, space: LockableSpace, expires: string): string {
    return createHmac('sha256', secret()).update(`${userId}:${space.id}:${space.lockHash}:${expires}`).digest('base64url');
  }

  private unlockToken(userId: string, space: LockableSpace): string {
    const expires = String(Date.now() + UNLOCK_MS);
    return `${expires}.${this.sign(userId, space, expires)}`;
  }

  isUnlocked(userId: string, space: LockableSpace, cookies: Map<string, string>): boolean {
    if (!space.lockHash) return true;
    const [expires = '', signature = ''] = (cookies.get(unlockCookieName(space.id)) ?? '').split('.');
    return Number(expires) > Date.now() && sameText(signature, this.sign(userId, space, expires));
  }

  async assertUnlocked(userId: string, spaceId: string, cookieHeader: string | undefined): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id, lockHash: spaces.lockHash })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId)));
    if (space && !this.isUnlocked(userId, space, readCookies(cookieHeader))) {
      throw new ForbiddenException('This space is locked');
    }
  }

  async isOpen(userId: string, spaceId: string, cookieHeader: string | undefined): Promise<boolean> {
    return this.isUnlocked(userId, await this.lockable(userId, spaceId), readCookies(cookieHeader));
  }

  async unlock(userId: string, spaceId: string, password: string): Promise<string> {
    const space = await this.lockable(userId, spaceId);
    if (!space.lockHash) throw new BadRequestException('This space has no password');
    await this.assertPassword(password, space.lockHash);
    return this.unlockToken(userId, space);
  }

  async setPassword(userId: string, spaceId: string, password: string, currentPassword?: string): Promise<string> {
    const space = await this.lockable(userId, spaceId);
    if (space.lockHash) await this.assertPassword(currentPassword ?? '', space.lockHash);
    const lockHash = await hashLockPassword(password);
    await this.db.update(spaces).set({ lockHash }).where(eq(spaces.id, spaceId));
    return this.unlockToken(userId, { id: spaceId, lockHash });
  }

  async removePassword(userId: string, spaceId: string, password: string): Promise<void> {
    const space = await this.lockable(userId, spaceId);
    if (space.lockHash) await this.assertPassword(password, space.lockHash);
    await this.db.update(spaces).set({ lockHash: null }).where(eq(spaces.id, spaceId));
  }

  // For a forgotten space password; the caller has already checked the account password.
  async resetPassword(userId: string, spaceId: string): Promise<void> {
    await this.lockable(userId, spaceId);
    await this.db.update(spaces).set({ lockHash: null }).where(eq(spaces.id, spaceId));
  }

  private async assertPassword(password: string, lockHash: string): Promise<void> {
    if (!(await matchesLockPassword(password, lockHash))) throw new ForbiddenException('That password is not right');
  }

  private async lockable(userId: string, spaceId: string): Promise<LockableSpace> {
    const [space] = await this.db
      .select({ id: spaces.id, kind: spaces.kind, tool: spaces.tool, lockHash: spaces.lockHash })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
    if (!space || space.kind !== 'space') throw new NotFoundException('Space not found');
    if (space.tool === 'vault') throw new BadRequestException('A vault already has its own passcode');
    return space;
  }
}
