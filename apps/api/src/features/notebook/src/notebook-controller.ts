import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { createPageSchema, listPagesSchema, updatePageSchema } from './notebook-schemas.ts';
import { NotebookService } from './notebook-service.ts';

@UseGuards(AuthGuard)
@Controller('notebook-pages')
export class NotebookController {
  constructor(@Inject(NotebookService) private readonly notebook: NotebookService) {}

  @Get()
  list(@UserId() userId: string, @Query() query: unknown) {
    return this.notebook.list(userId, parseOrThrow(listPagesSchema, query).spaceId);
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.notebook.create(userId, parseOrThrow(createPageSchema, body));
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
