import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { jobs } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { newJobSchema, readPostingSchema, saveCvSchema, spaceQuerySchema, updateJobSchema } from './jobs-schemas.ts';
import { JobsService } from './jobs-service.ts';
import { readPostingPage } from './posting-page.ts';

@UseGuards(AuthGuard)
@Controller('jobs')
export class JobsController {
  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return { ...(await this.jobs.load(ownerId, spaceId)), aiEnabled: this.ai.enabled };
  }

  @Put('profile')
  async saveCv(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, cvText } = parseOrThrow(saveCvSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.jobs.saveCv(ownerId, spaceId, cvText || null);
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown) {
    const job = parseOrThrow(newJobSchema, body);
    const { ownerId } = await this.access.resolve(userId, job.spaceId, 'edit');
    return this.jobs.create(ownerId, job);
  }

  // Reads the posting and returns its facts; nothing is stored until the browser creates the job.
  @Post('ai/read-posting')
  async readPosting(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, url } = parseOrThrow(readPostingSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.jobs.assertSpace(ownerId, spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const page = await readPostingPage(url);
    if (!page.ok) return page;
    const posting = await this.ai.readPosting(page);
    return posting ? { ok: true, posting } : { ok: false, reason: 'notPosting' };
  }

  @Post(':id/match')
  async match(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    const { ownerId } = await this.access.resolveRow(userId, jobs, id, 'edit');
    const { spaceId, cvText, ...job } = await this.jobs.forMatch(ownerId, id);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.jobs.saveMatch(ownerId, id, await this.ai.matchJob(cvText, job));
  }

  @Patch(':id')
  async update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const changes = parseOrThrow(updateJobSchema, body);
    const { ownerId } = await this.access.resolveRow(userId, jobs, id, 'edit');
    return this.jobs.update(ownerId, id, changes);
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, jobs, id, 'edit');
    return this.jobs.remove(ownerId, id);
  }
}
