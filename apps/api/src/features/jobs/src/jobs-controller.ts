import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceLockService } from '../../spaces/index.ts';
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
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return { ...(await this.jobs.load(userId, spaceId)), aiEnabled: this.ai.enabled };
  }

  @Put('profile')
  saveCv(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, cvText } = parseOrThrow(saveCvSchema, body);
    return this.jobs.saveCv(userId, spaceId, cvText || null);
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.jobs.create(userId, parseOrThrow(newJobSchema, body));
  }

  // Reads the posting and returns its facts; nothing is stored until the browser creates the job.
  @Post('ai/read-posting')
  async readPosting(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, url } = parseOrThrow(readPostingSchema, body);
    await this.jobs.assertSpace(userId, spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    const page = await readPostingPage(url);
    if (!page.ok) return page;
    const posting = await this.ai.readPosting(page);
    return posting ? { ok: true, posting } : { ok: false, reason: 'notPosting' };
  }

  @Post(':id/match')
  async match(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    const { spaceId, cvText, ...job } = await this.jobs.forMatch(userId, id);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.jobs.saveMatch(userId, id, await this.ai.matchJob(cvText, job));
  }

  @Patch(':id')
  update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.jobs.update(userId, id, parseOrThrow(updateJobSchema, body));
  }

  @Delete(':id')
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.remove(userId, id);
  }
}
