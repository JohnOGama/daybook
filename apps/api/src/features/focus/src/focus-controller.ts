import { Body, Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { rangeSchema, sessionSchema, settingsSchema } from './focus-schemas.ts';
import { FocusService } from './focus-service.ts';

@UseGuards(AuthGuard)
@Controller('focus')
export class FocusController {
  constructor(
    @Inject(FocusService) private readonly focus: FocusService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get(':spaceId')
  async load(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Query() query: unknown, @Req() request: Request) {
    const { from, to } = parseOrThrow(rangeSchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.assertFocusSpace(spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.focus.load(ownerId, spaceId, from, to);
  }

  @Put(':spaceId/settings')
  async saveSettings(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    const settings = parseOrThrow(settingsSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.assertFocusSpace(spaceId);
    return this.focus.saveSettings(ownerId, spaceId, settings);
  }

  @Post(':spaceId/sessions')
  async addSession(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    const session = parseOrThrow(sessionSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.assertFocusSpace(spaceId);
    return this.focus.addSession(ownerId, spaceId, session);
  }

  private async assertFocusSpace(spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.tool, 'focus'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Focus space not found');
  }
}
