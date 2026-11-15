import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { diagrams, spaces } from '../../../shared/db/schema.ts';
import type { Positions } from './diagrams-schemas.ts';

@Injectable()
export class DiagramsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async load(userId: string, spaceId: string): Promise<{ dbml: string; positions: Positions; updatedAt: string | null; version: number }> {
    await this.assertSpace(userId, spaceId);
    const [row] = await this.db.select().from(diagrams).where(eq(diagrams.spaceId, spaceId));
    return row
      ? { dbml: row.dbml, positions: row.positions, updatedAt: new Date(row.updatedAt).toISOString(), version: row.version }
      : { dbml: '', positions: {}, updatedAt: null, version: 0 };
  }

  // For the live room: no owner check here, the realtime connection has already resolved access.
  async loadDoc(spaceId: string): Promise<{ ownerId: string; dbml: string; positions: Positions; ydoc: Uint8Array | null } | null> {
    const [space] = await this.db
      .select({ ownerId: spaces.userId })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.tool, 'diagram'), isNull(spaces.deletedAt)));
    if (!space) return null;
    const [row] = await this.db.select().from(diagrams).where(eq(diagrams.spaceId, spaceId));
    return { ownerId: space.ownerId, dbml: row?.dbml ?? '', positions: row?.positions ?? {}, ydoc: row?.ydoc ?? null };
  }

  async saveDoc(ownerId: string, spaceId: string, doc: { dbml: string; positions: Positions; ydoc: Uint8Array }): Promise<void> {
    const updatedAt = new Date().toISOString();
    await this.db
      .insert(diagrams)
      .values({ spaceId, userId: ownerId, ...doc, updatedAt, version: 1 })
      .onConflictDoUpdate({ target: diagrams.spaceId, set: { ...doc, updatedAt, version: sql`${diagrams.version} + 1` } });
  }

  async assertSpace(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'diagram'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Diagram space not found');
  }
}
