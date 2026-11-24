import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { diagrams, notebookPages, type ShareRole, spaceShares, spaces, tasks, user } from '../../../shared/db/schema.ts';
import { copyTitle } from '../../../shared/utils/copy-title.ts';
import { type DotStatus, dotStatuses } from '../../../shared/utils/pipeline-status.ts';
import { type UptimeDot, uptimeDots } from '../../../shared/utils/uptime-status.ts';
import { type Access, SpaceAccessService, type SpaceRow } from './space-access-service.ts';
import { SpaceGroupsService } from './space-groups-service.ts';
import type { CreateSpaceInput, ShareInput } from './space-schemas.ts';

export type ShareDto = { id: string; email: string; role: ShareRole };

export type SpaceDto = {
  id: string;
  parentId: string | null;
  // The sidebar group of your own top-level folder or space; null inside a folder and on spaces shared with you.
  groupId: string | null;
  kind: SpaceRow['kind'];
  title: string;
  tool: SpaceRow['tool'];
  carryOver: boolean;
  locked: boolean;
  createdAt: string;
  openToday: number;
  access: Access;
  shared: boolean;
  ownerId: string;
  ownerName: string | null;
  // The sidebar dot of a Pipelines space; null for other tools and for a Pipelines space with no runs.
  pipelines: DotStatus;
  // The sidebar dot of an Uptime space; null for other tools and for one with no checked, unpaused sites.
  uptime: UptimeDot;
};

type Sharing = Pick<SpaceDto, 'access' | 'shared' | 'ownerName'>;
const ownSpace: Sharing = { access: 'owner', shared: false, ownerName: null };
const shareColumns = { id: spaceShares.id, email: spaceShares.email, role: spaceShares.role };

function toDto(row: SpaceRow, openToday: number, sharing: Sharing = ownSpace, pipelines: DotStatus = null, uptime: UptimeDot = null): SpaceDto {
  return {
    id: row.id,
    parentId: row.parentId,
    groupId: sharing.access === 'owner' && row.parentId === null ? row.groupId : null,
    kind: row.kind,
    title: row.title,
    tool: row.tool,
    carryOver: row.carryOver,
    locked: row.lockHash !== null,
    createdAt: row.createdAt.toISOString(),
    openToday,
    ...sharing,
    ownerId: row.userId,
    pipelines,
    uptime,
  };
}

const lastWhenNull = (position: number | null) => position ?? Number.MAX_SAFE_INTEGER;
const inSpaceOrder = (a: SpaceRow, b: SpaceRow) =>
  lastWhenNull(a.position) - lastWhenNull(b.position) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

@Injectable()
export class SpacesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceGroupsService) private readonly groups: SpaceGroupsService = new SpaceGroupsService(db),
  ) {}

  async list(userId: string, today: string): Promise<SpaceDto[]> {
    const [rows, ownOpenTasks, sharedWithMe, myShares] = await Promise.all([
      this.db
        .select()
        .from(spaces)
        .where(and(eq(spaces.userId, userId), isNull(spaces.deletedAt)))
        .orderBy(asc(spaces.position), asc(spaces.createdAt), asc(spaces.id)),
      this.openTasks(eq(tasks.userId, userId)),
      this.access.sharedWith(userId),
      this.db.selectDistinct({ spaceId: spaceShares.spaceId }).from(spaceShares).where(eq(spaceShares.ownerId, userId)),
    ]);
    const sharedIds = sharedWithMe.map((shared) => shared.row.id);
    const sharedOpenTasks = sharedIds.length > 0 ? await this.openTasks(inArray(tasks.spaceId, sharedIds)) : [];

    const carriesOver = new Map([...rows, ...sharedWithMe.map((shared) => shared.row)].map((row) => [row.id, row.carryOver]));
    const counts = new Map<string, number>();
    for (const { spaceId, plannedDay } of [...ownOpenTasks, ...sharedOpenTasks]) {
      if (plannedDay && (plannedDay === today || (plannedDay < today && carriesOver.get(spaceId)))) {
        counts.set(spaceId, (counts.get(spaceId) ?? 0) + 1);
      }
    }

    const visible = [...rows, ...sharedWithMe.map((shared) => shared.row)];
    const dots = await dotStatuses(this.db, visible.filter((row) => row.tool === 'pipelines').map((row) => row.id));
    const uptime = await uptimeDots(this.db, visible.filter((row) => row.tool === 'uptime').map((row) => row.id));

    const visibleIds = new Set(rows.map((row) => row.id));
    const shared = new Set(myShares.map((share) => share.spaceId));
    const own = rows
      .filter((row) => row.parentId === null || visibleIds.has(row.parentId))
      .map((row) => toDto(row, counts.get(row.id) ?? 0, { ...ownSpace, shared: shared.has(row.id) }, dots.get(row.id) ?? null, uptime.get(row.id) ?? null));
    const theirs = sharedWithMe
      .sort((a, b) => inSpaceOrder(a.row, b.row))
      .map(({ row, access, ownerName }) => toDto(row, counts.get(row.id) ?? 0, { access, shared: false, ownerName }, dots.get(row.id) ?? null, uptime.get(row.id) ?? null));
    return [...own, ...theirs];
  }

  private openTasks(scope: SQL) {
    return this.db
      .select({ spaceId: tasks.spaceId, plannedDay: tasks.plannedDay })
      .from(tasks)
      .where(and(scope, isNull(tasks.parentId), isNull(tasks.completedOn), isNull(tasks.deletedAt)));
  }

  async shares(userId: string, spaceId: string): Promise<ShareDto[]> {
    await this.ownedSpace(userId, spaceId);
    return this.db
      .select(shareColumns)
      .from(spaceShares)
      .where(eq(spaceShares.spaceId, spaceId))
      .orderBy(asc(spaceShares.createdAt), asc(spaceShares.id));
  }

  async share(userId: string, spaceId: string, input: ShareInput): Promise<ShareDto> {
    const space = await this.ownedSpace(userId, spaceId);
    if (space.tool === 'vault') throw new BadRequestException("A vault can't be shared");
    if ((await this.emailOf(userId)) === input.email) throw new BadRequestException("That's your own email");
    const [saved] = await this.db
      .insert(spaceShares)
      .values({ id: input.id, spaceId, ownerId: userId, email: input.email, role: input.role })
      .onConflictDoUpdate({ target: [spaceShares.spaceId, spaceShares.email], set: { role: input.role } })
      .returning(shareColumns);
    return saved;
  }

  async changeShare(userId: string, spaceId: string, shareId: string, role: ShareRole): Promise<void> {
    await this.ownedSpace(userId, spaceId);
    const changed = await this.db
      .update(spaceShares)
      .set({ role })
      .where(and(eq(spaceShares.id, shareId), eq(spaceShares.spaceId, spaceId)))
      .returning({ id: spaceShares.id });
    if (changed.length === 0) throw new NotFoundException('Share not found');
  }

  async removeShare(userId: string, spaceId: string, shareId: string): Promise<void> {
    await this.ownedSpace(userId, spaceId);
    const removed = await this.db
      .delete(spaceShares)
      .where(and(eq(spaceShares.id, shareId), eq(spaceShares.spaceId, spaceId)))
      .returning({ id: spaceShares.id });
    if (removed.length === 0) throw new NotFoundException('Share not found');
  }

  // A recipient leaves a share made to them on this exact space; a folder share is left from the folder.
  async leave(userId: string, spaceId: string): Promise<void> {
    const left = await this.db
      .delete(spaceShares)
      .where(and(eq(spaceShares.spaceId, spaceId), eq(spaceShares.email, await this.emailOf(userId))))
      .returning({ id: spaceShares.id });
    if (left.length === 0) throw new NotFoundException('Share not found');
  }

  async create(userId: string, input: CreateSpaceInput): Promise<SpaceDto> {
    const parentId = input.kind === 'space' ? input.parentId : undefined;
    if (parentId) await this.assertOwnedFolder(userId, parentId);
    const groupId = parentId ? null : await this.groups.resolve(userId, input.groupId);
    const [created] = await this.db
      .insert(spaces)
      .values({
        id: input.id,
        userId,
        kind: input.kind,
        title: input.title,
        tool: input.kind === 'space' ? input.tool : null,
        parentId,
        groupId,
      })
      .returning();
    return toDto(created, 0);
  }

  async rename(userId: string, id: string, title: string): Promise<void> {
    const renamed = await this.db
      .update(spaces)
      .set({ title })
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    if (renamed.length === 0) throw new NotFoundException('Space not found');
  }

  async reorder(userId: string, ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Each space can appear only once');
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ parentId: spaces.parentId })
        .from(spaces)
        .where(and(eq(spaces.userId, userId), isNull(spaces.deletedAt), inArray(spaces.id, ids)));
      if (rows.length !== ids.length) throw new NotFoundException('Space not found');
      if (rows.some((row) => row.parentId !== rows[0].parentId)) {
        throw new BadRequestException('Only spaces in the same group can be reordered together');
      }
      for (const [position, id] of ids.entries()) {
        await tx.update(spaces).set({ position }).where(eq(spaces.id, id));
      }
    });
  }

  // Puts a space into a folder, or back at the top level, as the last one there.
  async move(userId: string, id: string, parentId: string | null): Promise<void> {
    if (parentId) await this.assertOwnedFolder(userId, parentId);
    await this.db.transaction(async (tx) => {
      const siblings = await tx
        .select({ id: spaces.id })
        .from(spaces)
        .where(and(eq(spaces.userId, userId), isNull(spaces.deletedAt), parentId ? eq(spaces.parentId, parentId) : isNull(spaces.parentId)))
        .orderBy(asc(spaces.position), asc(spaces.createdAt), asc(spaces.id));
      const others = siblings.filter((sibling) => sibling.id !== id);
      for (const [position, sibling] of others.entries()) {
        await tx.update(spaces).set({ position }).where(eq(spaces.id, sibling.id));
      }
      // Out of a folder, a space lands in that folder's group.
      const [current] = await tx.select({ parentId: spaces.parentId, groupId: spaces.groupId }).from(spaces).where(and(eq(spaces.id, id), eq(spaces.userId, userId)));
      const [folder] = current?.parentId ? await tx.select({ groupId: spaces.groupId }).from(spaces).where(eq(spaces.id, current.parentId)) : [];
      const groupId = parentId ? null : (folder?.groupId ?? current?.groupId ?? null);
      const moved = await tx
        .update(spaces)
        .set({ parentId, groupId, position: others.length })
        .where(and(eq(spaces.id, id), eq(spaces.userId, userId), eq(spaces.kind, 'space'), isNull(spaces.deletedAt)))
        .returning({ id: spaces.id });
      if (moved.length === 0) throw new NotFoundException('Space not found');
    });
  }

  // Puts your folder or space into another of your groups (a space in a folder comes out of it), last there,
  // or where `order` (the group's top-level ids, in their new order) puts it.
  async moveToGroup(userId: string, id: string, groupId: string, order?: string[]): Promise<void> {
    await this.groups.resolve(userId, groupId);
    const moved = await this.db
      .update(spaces)
      .set({ groupId, parentId: null, position: null })
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    if (moved.length === 0) throw new NotFoundException('Space not found');
    if (order?.includes(id)) await this.reorder(userId, order);
  }

  async setCarryOver(userId: string, id: string, carryOver: boolean): Promise<void> {
    const updated = await this.db
      .update(spaces)
      .set({ carryOver })
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), eq(spaces.tool, 'list'), isNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    if (updated.length === 0) throw new NotFoundException('Space not found');
  }

  async duplicate(userId: string, id: string, newId?: string): Promise<SpaceDto> {
    return this.db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(spaces)
        .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
      if (!source) throw new NotFoundException('Space not found');
      if (source.kind !== 'space') throw new BadRequestException('Only a space can be duplicated');
      if (source.tool === 'vault' || source.tool === 'budget' || source.tool === 'fitness' || source.tool === 'jobs' || source.tool === 'pipelines' || source.tool === 'uptime' || source.tool === 'focus') {
        throw new BadRequestException(`A ${source.tool} space cannot be duplicated`);
      }

      const [copy] = await tx
        .insert(spaces)
        .values({
          id: newId,
          userId,
          parentId: source.parentId,
          groupId: source.groupId,
          kind: 'space',
          tool: source.tool,
          carryOver: source.carryOver,
          lockHash: source.lockHash,
          title: copyTitle(source.title),
        })
        .returning();

      const pages = await tx
        .select()
        .from(notebookPages)
        .where(and(eq(notebookPages.spaceId, id), isNull(notebookPages.deletedAt)));
      if (pages.length > 0) {
        await tx.insert(notebookPages).values(
          pages.map(({ title, content, position, createdAt }) => ({ userId, spaceId: copy.id, title, content, position, createdAt })),
        );
      }

      const [diagram] = await tx.select().from(diagrams).where(eq(diagrams.spaceId, id));
      if (diagram) await tx.insert(diagrams).values({ spaceId: copy.id, userId, dbml: diagram.dbml, positions: diagram.positions });

      const inOrder = [asc(tasks.position), asc(tasks.createdAt), asc(tasks.id)];
      const parents = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.spaceId, id), isNull(tasks.parentId), isNull(tasks.completedOn), isNull(tasks.deletedAt)))
        .orderBy(...inOrder);
      if (parents.length === 0) return toDto(copy, 0);

      const copiedIds = new Map(parents.map((parent) => [parent.id, randomUUID()]));
      const shared = { userId, spaceId: copy.id };
      await tx.insert(tasks).values(
        parents.map((parent, position) => ({
          ...shared,
          id: copiedIds.get(parent.id),
          title: parent.title,
          plannedDay: parent.plannedDay,
          status: parent.status,
          highPriority: parent.highPriority,
          position,
        })),
      );

      let level = [...copiedIds.keys()];
      while (level.length > 0) {
        const subtasks = await tx
          .select()
          .from(tasks)
          .where(and(inArray(tasks.parentId, level), isNull(tasks.deletedAt)))
          .orderBy(...inOrder);
        if (subtasks.length === 0) break;
        for (const subtask of subtasks) copiedIds.set(subtask.id, randomUUID());
        await tx.insert(tasks).values(
          subtasks.map((subtask, position) => ({
            ...shared,
            id: copiedIds.get(subtask.id),
            parentId: copiedIds.get(subtask.parentId as string),
            title: subtask.title,
            status: subtask.completedOn ? ('todo' as const) : subtask.status,
            highPriority: subtask.highPriority,
            position,
          })),
        );
        level = subtasks.map((subtask) => subtask.id);
      }
      return toDto(copy, 0);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .update(spaces)
      .set({ deletedAt: new Date() })
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)))
      .returning({ id: spaces.id });
    if (deleted.length === 0) throw new NotFoundException('Space not found');
  }

  private async ownedSpace(userId: string, id: string): Promise<Pick<SpaceRow, 'tool'>> {
    const [space] = await this.db
      .select({ tool: spaces.tool })
      .from(spaces)
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  private async emailOf(userId: string): Promise<string> {
    const [row] = await this.db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    return row?.email.trim().toLowerCase() ?? '';
  }

  private async assertOwnedFolder(userId: string, id: string): Promise<void> {
    const [parent] = await this.db
      .select({ kind: spaces.kind })
      .from(spaces)
      .where(and(eq(spaces.id, id), eq(spaces.userId, userId), isNull(spaces.deletedAt)));
    if (!parent) throw new NotFoundException('Folder not found');
    if (parent.kind !== 'folder') throw new BadRequestException('Spaces can only go inside folders');
  }
}
