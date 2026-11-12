import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceLockService } from '../../spaces/index.ts';
import { createPageSchema, listPagesSchema, reorderPagesSchema, updatePageSchema } from './notebook-schemas.ts';
import { NotebookService } from './notebook-service.ts';

@UseGuards(AuthGuard)
@Controller('notebook-pages')
export class NotebookController {
  constructor(
    @Inject(NotebookService) private readonly notebook: NotebookService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
  ) {}

  @Get()
  async list(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(listPagesSchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.notebook.list(userId, spaceId);
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.notebook.create(userId, parseOrThrow(createPageSchema, body));
  }

  @Put('order')
  reorder(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, ids } = parseOrThrow(reorderPagesSchema, body);
    return this.notebook.reorder(userId, spaceId, ids);
  }

  @Patch(':id')
  update(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.notebook.update(userId, id, parseOrThrow(updatePageSchema, body));
  }

  @Delete(':id')
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notebook.remove(userId, id);
  }
}
