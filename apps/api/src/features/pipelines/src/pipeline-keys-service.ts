import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { pipelineKeys, spaces } from '../../../shared/db/schema.ts';

// A random 192-bit key needs no slow hash: SHA-256 is enough to keep the stored value useless on its own.
const hash = (key: string) => createHash('sha256').update(key).digest('hex');

@Injectable()
export class PipelineKeysService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Makes a new key for the space, replacing any old one, which stops working at once. The plain key is returned only here.
  async create(spaceId: string): Promise<string> {
    const key = `dbk_${randomBytes(24).toString('base64url')}`;
    const row = { keyHash: hash(key), createdAt: new Date().toISOString(), lastUsedAt: null };
    await this.db.insert(pipelineKeys).values({ spaceId, ...row }).onConflictDoUpdate({ target: pipelineKeys.spaceId, set: row });
    return key;
  }

  async status(spaceId: string): Promise<{ createdAt: string; lastUsedAt: string | null } | null> {
    const [row] = await this.db.select().from(pipelineKeys).where(eq(pipelineKeys.spaceId, spaceId));
    return row ? { createdAt: new Date(row.createdAt).toISOString(), lastUsedAt: row.lastUsedAt && new Date(row.lastUsedAt).toISOString() } : null;
  }

  // The live Pipelines space a key reports into, or null for any key that doesn't open one.
  async spaceFor(key: string): Promise<{ spaceId: string; ownerId: string } | null> {
    const [row] = await this.db
      .select({ spaceId: spaces.id, ownerId: spaces.userId })
      .from(pipelineKeys)
      .innerJoin(spaces, eq(spaces.id, pipelineKeys.spaceId))
      .where(and(eq(pipelineKeys.keyHash, hash(key)), eq(spaces.tool, 'pipelines'), isNull(spaces.deletedAt)));
    if (!row) return null;
    await this.db.update(pipelineKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(pipelineKeys.spaceId, row.spaceId));
    return row;
  }
}
