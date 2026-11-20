import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { notebookPages } from '../../../shared/db/schema.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { createPageSchema, improveSkillSchema, improveTextSchema, listPagesSchema, reorderPagesSchema, updatePageSchema } from './notebook-schemas.ts';
import { NotebookService } from './notebook-service.ts';

@UseGuards(AuthGuard)
@Controller('notebook-pages')
export class NotebookController {
  constructor(
    @Inject(NotebookService) private readonly notebook: NotebookService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
  ) {}

  @Get()
  async list(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(listPagesSchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.notebook.list(ownerId, spaceId);
  }

  @Post()
  async create(@UserId() userId: string, @Body() body: unknown) {
    const input = parseOrThrow(createPageSchema, body);
    const { ownerId } = await this.access.resolve(userId, input.spaceId, 'edit');
    return this.notebook.create(ownerId, input);
  }

  // Works on the text sent with the request; the space is named only to check the caller may edit it.
  @Post('ai/improve')
  async improve(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, text, instruction } = parseOrThrow(improveTextSchema, body);
    await this.access.resolve(userId, spaceId, 'edit');
    return { text: await this.ai.rewrite(text, instruction) };
  }

  // Like improve: only the skill sent with the request goes to the AI, and nothing is saved here.
  @Post('ai/skill')
  async improveSkill(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, skill, instruction } = parseOrThrow(improveSkillSchema, body);
    await this.access.resolve(userId, spaceId, 'edit');
    return this.ai.improveSkill(skill, instruction);
  }

  @Put('order')
  async reorder(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, ids } = parseOrThrow(reorderPagesSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    return this.notebook.reorder(ownerId, spaceId, ids);
  }

  @Get(':id/versions')
  async versions(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    const { ownerId } = await this.access.resolveRow(userId, notebookPages, id, 'view');
    const spaceId = await this.notebook.spaceOf(ownerId, id);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.notebook.listVersions(ownerId, id);
  }

  @Get(':id/versions/:versionId')
  async version(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() request: Request,
  ) {
    const { ownerId } = await this.access.resolveRow(userId, notebookPages, id, 'view');
    const spaceId = await this.notebook.spaceOf(ownerId, id);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.notebook.getVersion(ownerId, id, versionId);
  }

  @Post(':id/versions')
  async checkpoint(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, notebookPages, id, 'edit');
    return this.notebook.checkpoint(ownerId, id);
  }

  @Patch(':id')
  async update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { ownerId } = await this.access.resolveRow(userId, notebookPages, id, 'edit');
    return this.notebook.update(ownerId, id, parseOrThrow(updatePageSchema, body));
  }

  @Delete(':id')
  async remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const { ownerId } = await this.access.resolveRow(userId, notebookPages, id, 'edit');
    return this.notebook.remove(ownerId, id);
  }
}
