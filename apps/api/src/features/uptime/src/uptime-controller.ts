import { BadRequestException, Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, uptimeMonitors } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { UPTIME_NOTIFIER, type UptimeNotifier } from './uptime-notifier.ts';
import { UPTIME_CHECKER, type UptimeChecker } from './uptime-scheduler.ts';
import { monitorSchema, updateMonitorSchema } from './uptime-schemas.ts';
import { UptimeService } from './uptime-service.ts';
import type { MonitorRow } from './uptime-types.ts';

const CHECK_NOW_GAP_MS = 10_000;

@UseGuards(AuthGuard)
@Controller('uptime')
export class UptimeController {
  // ponytail: in memory, so a restart forgets it; fine while the API runs as one instance
  private readonly lastCheckNow = new Map<string, number>();

  constructor(
    @Inject(UptimeService) private readonly uptime: UptimeService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(UPTIME_CHECKER) private readonly checker: UptimeChecker,
    @Inject(UPTIME_NOTIFIER) private readonly notifier: UptimeNotifier,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get('monitors/:id')
  async monitor(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    const { ownerId, spaceId } = await this.access.resolveRow(userId, uptimeMonitors, id, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.uptime.monitor(ownerId, id);
  }

  @Get(':spaceId')
  async load(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Req() request: Request) {
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.assertUptimeSpace(spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.uptime.load(ownerId, spaceId);
  }

  // A new site is checked before the answer, so it shows green or red straight away.
  @Post(':spaceId/monitors')
  async add(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    const input = parseOrThrow(monitorSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.assertUptimeSpace(spaceId);
    await this.assertPublic(input.url);
    await this.uptime.create(ownerId, spaceId, input);
    return this.checkNow(ownerId, input.id);
  }

  @Patch('monitors/:id')
  async update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateMonitorSchema, body);
    const { ownerId, spaceId } = await this.access.resolveRow(userId, uptimeMonitors, id, 'edit');
    // Only a new address is vetted and checked: a rename must save at once, even while the site is broken.
    const newUrl = changes.url !== undefined && changes.url !== (await this.uptime.row(ownerId, id)).url;
    if (newUrl) await this.assertPublic(changes.url as string);
    await this.uptime.update(ownerId, id, changes);
    // Pausing takes a site out of the dot, so the sidebar may change.
    if (changes.paused !== undefined) await this.notifier.changed(spaceId);
    if (newUrl) return this.checkNow(ownerId, id);
    return this.uptime.row(ownerId, id);
  }

  @Post('monitors/:id/check')
  async check(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, uptimeMonitors, id, 'edit');
    const last = this.lastCheckNow.get(id) ?? 0;
    if (Date.now() - last < CHECK_NOW_GAP_MS) throw new HttpException('Wait a few seconds before checking again', HttpStatus.TOO_MANY_REQUESTS);
    this.lastCheckNow.set(id, Date.now());
    return this.checkNow(ownerId, id);
  }

  // Its checks and incidents go with it; there is no undo because the history can't come back.
  @Delete('monitors/:id')
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId, spaceId } = await this.access.resolveRow(userId, uptimeMonitors, id, 'edit');
    await this.uptime.remove(ownerId, id);
    this.lastCheckNow.delete(id);
    await this.notifier.changed(spaceId);
  }

  private async checkNow(ownerId: string, id: string): Promise<MonitorRow> {
    const { url } = await this.uptime.row(ownerId, id);
    const recorded = await this.uptime.record(id, await this.checker.check(url));
    if (recorded?.changed) await this.notifier.changed(recorded.spaceId);
    return this.uptime.row(ownerId, id);
  }

  private async assertPublic(url: string): Promise<void> {
    if (!(await this.checker.isPublic(url))) throw new BadRequestException('Public addresses only');
  }

  private async assertUptimeSpace(spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.tool, 'uptime'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Uptime space not found');
  }
}
