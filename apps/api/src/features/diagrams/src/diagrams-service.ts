import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { diagrams, spaces } from '../../../shared/db/schema.ts';
import type { Positions } from './diagrams-schemas.ts';

@Injectable()
export class DiagramsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async load(userId: string, spaceId: string): Promise<{ dbml: string; positions: Positions; updatedAt: string | null }> {
    await this.assertSpace(userId, spaceId);
    const [row] = await this.db.select().from(diagrams).where(eq(diagrams.spaceId, spaceId));
    return row ? { dbml: row.dbml, positions: row.positions, updatedAt: new Date(row.updatedAt).toISOString() } : { dbml: '', positions: {}, updatedAt: null };
  }

  async save(userId: string, spaceId: string, { dbml, positions }: { dbml: string; positions: Positions }): Promise<void> {
    await this.assertSpace(userId, spaceId);
    const updatedAt = new Date().toISOString();
    await this.db
      .insert(diagrams)
      .values({ spaceId, userId, dbml, positions, updatedAt })
      .onConflictDoUpdate({ target: diagrams.spaceId, set: { dbml, positions, updatedAt } });
  }

  async assertSpace(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'diagram'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Diagram space not found');
  }
}
