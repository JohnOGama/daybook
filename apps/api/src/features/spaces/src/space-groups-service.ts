import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaceGroups, spaces } from '../../../shared/db/schema.ts';

export type SpaceGroupDto = { id: string; title: string };

export const DEFAULT_GROUP_TITLE = 'Spaces';
const columns = { id: spaceGroups.id, title: spaceGroups.title };

@Injectable()
export class SpaceGroupsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // Every user has at least one group: the first read makes "Spaces" if there is none.
  // ponytail: two first reads at the same moment could each make one; harmless (rename or delete the extra), add a unique default flag if it ever matters.
  async list(userId: string): Promise<SpaceGroupDto[]> {
    const groups = await this.live(userId);
    if (groups.length > 0) return groups;
    const [created] = await this.db.insert(spaceGroups).values({ userId, title: DEFAULT_GROUP_TITLE, position: 0 }).returning(columns);
    await this.db
      .update(spaces)
      .set({ groupId: created.id })
      .where(and(eq(spaces.userId, userId), isNull(spaces.parentId), isNull(spaces.groupId)));
    return [created];
  }

  // The group a new top-level folder or space goes into: the one asked for (if it's yours), else your first.
  async resolve(userId: string, groupId?: string): Promise<string> {
    const groups = await this.list(userId);
    if (!groupId) return groups[0].id;
    if (!groups.some((group) => group.id === groupId)) throw new NotFoundException('Group not found');
    return groupId;
  }

  async create(userId: string, input: { id?: string; title: string }): Promise<SpaceGroupDto> {
    const [created] = await this.db
      .insert(spaceGroups)
      .values({ id: input.id, userId, title: input.title, position: (await this.list(userId)).length })
      .returning(columns);
    return created;
  }

  async rename(userId: string, id: string, title: string): Promise<void> {
    const renamed = await this.db
      .update(spaceGroups)
      .set({ title })
      .where(and(eq(spaceGroups.id, id), eq(spaceGroups.userId, userId), isNull(spaceGroups.deletedAt)))
      .returning({ id: spaceGroups.id });
    if (renamed.length === 0) throw new NotFoundException('Group not found');
  }

  // ids must be exactly your groups, in their new order.
  async reorder(userId: string, ids: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const groups = await this.live(userId, tx);
      const known = new Set(groups.map((group) => group.id));
      if (new Set(ids).size !== ids.length || ids.length !== groups.length || !ids.every((id) => known.has(id))) {
        throw new BadRequestException('Send every group once');
      }
      for (const [position, id] of ids.entries()) {
        await tx.update(spaceGroups).set({ position }).where(eq(spaceGroups.id, id));
      }
    });
  }

  // The group and every folder and space at its top level go to Trash together; your last group can't go.
  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const groups = await this.live(userId, tx);
      if (!groups.some((group) => group.id === id)) throw new NotFoundException('Group not found');
      if (groups.length === 1) throw new BadRequestException("You can't delete your only group");
      const deletedAt = new Date();
      await tx.update(spaceGroups).set({ deletedAt }).where(eq(spaceGroups.id, id));
      await tx
        .update(spaces)
        .set({ deletedAt })
        .where(and(eq(spaces.userId, userId), eq(spaces.groupId, id), isNull(spaces.parentId), isNull(spaces.deletedAt)));
    });
  }

  private live(userId: string, db: Db = this.db): Promise<SpaceGroupDto[]> {
    return db
      .select(columns)
      .from(spaceGroups)
      .where(and(eq(spaceGroups.userId, userId), isNull(spaceGroups.deletedAt)))
      .orderBy(asc(spaceGroups.position), asc(spaceGroups.createdAt), asc(spaceGroups.id));
  }
}
