import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { createGroupSchema, renameSpaceSchema, reorderSpacesSchema } from './space-schemas.ts';
import { SpaceGroupsService } from './space-groups-service.ts';

@UseGuards(AuthGuard)
@Controller('space-groups')
export class SpaceGroupsController {
  constructor(@Inject(SpaceGroupsService) private readonly groups: SpaceGroupsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.groups.list(userId);
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.groups.create(userId, parseOrThrow(createGroupSchema, body));
  }

  @Put('order')
  reorder(@UserId() userId: string, @Body() body: unknown) {
    return this.groups.reorder(userId, parseOrThrow(reorderSpacesSchema, body).ids);
  }

  @Patch(':id')
  rename(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.groups.rename(userId, id, parseOrThrow(renameSpaceSchema, body).title);
  }

  @Delete(':id')
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.remove(userId, id);
  }
}
