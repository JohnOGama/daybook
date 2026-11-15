import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

  // Saves only over the version the diagram was edited from. Version 0 is the first save, which creates the row.
  async save(userId: string, spaceId: string, { dbml, positions, version }: { dbml: string; positions: Positions; version: number }): Promise<{ version: number }> {
    await this.assertSpace(userId, spaceId);
    const changes = { dbml, positions, updatedAt: new Date().toISOString(), version: sql`${diagrams.version} + 1` };
    const [saved] =
      version === 0
        ? await this.db
            .insert(diagrams)
            .values({ spaceId, userId, dbml, positions, updatedAt: changes.updatedAt, version: 1 })
            .onConflictDoUpdate({ target: diagrams.spaceId, set: changes, setWhere: eq(diagrams.version, 0) })
            .returning({ version: diagrams.version })
        : await this.db
            .update(diagrams)
            .set(changes)
            .where(and(eq(diagrams.spaceId, spaceId), eq(diagrams.version, version)))
            .returning({ version: diagrams.version });
    // The space was checked above, so a refused save is always a stale one.
    if (!saved) throw new ConflictException('Changed by someone else');
    return saved;
  }

  async assertSpace(userId: string, spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.userId, userId), eq(spaces.tool, 'diagram'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Diagram space not found');
  }
}
