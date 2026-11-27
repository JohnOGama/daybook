import { Body, Controller, Delete, Get, HttpException, HttpStatus, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { securityFindings, spaces } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { findingSchema, scanSchema, updateFindingSchema } from './security-schemas.ts';
import { SecurityService } from './security-service.ts';

const SCAN_GAP_MS = 10_000;

@UseGuards(AuthGuard)
@Controller('security')
export class SecurityController {
  // ponytail: in memory, so a restart forgets it; fine while the API runs as one instance
  private readonly lastScan = new Map<string, number>();

  constructor(
    @Inject(SecurityService) private readonly security: SecurityService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(DB) private readonly db: Db,
  ) {}

  // Runs a passive scan of the target and stores the findings. `authorized: true` is required by the schema.
  @Post(':spaceId/scan')
  async scan(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    const { url } = parseOrThrow(scanSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.assertSecuritySpace(spaceId);
    const last = this.lastScan.get(spaceId) ?? 0;
    if (Date.now() - last < SCAN_GAP_MS) throw new HttpException('Wait a few seconds before scanning again', HttpStatus.TOO_MANY_REQUESTS);
    this.lastScan.set(spaceId, Date.now());
    return this.security.scan(ownerId, spaceId, url);
  }

  @Get(':spaceId')
  async load(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Req() request: Request) {
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.assertSecuritySpace(spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.security.load(ownerId, spaceId);
  }

  @Post(':spaceId/findings')
  async add(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string, @Body() body: unknown) {
    const input = parseOrThrow(findingSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.assertSecuritySpace(spaceId);
    return this.security.create(ownerId, spaceId, input);
  }

  @Patch('findings/:id')
  async update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateFindingSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, securityFindings, id, 'edit');
    return this.security.update(ownerId, id, changes);
  }

  @Delete('findings/:id')
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, securityFindings, id, 'edit');
    await this.security.remove(ownerId, id);
  }

  private async assertSecuritySpace(spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.tool, 'security'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Security space not found');
  }
}
