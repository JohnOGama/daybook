import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import {
  carryOverSchema,
  createSpaceSchema,
  duplicateSpaceSchema,
  listSpacesSchema,
  moveSpaceSchema,
  renameSpaceSchema,
  reorderSpacesSchema,
} from './space-schemas.ts';
import { SpacesService } from './spaces-service.ts';

@UseGuards(AuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(@Inject(SpacesService) private readonly spaces: SpacesService) {}

  @Get()
  list(@UserId() userId: string, @Query() query: unknown) {
    return this.spaces.list(userId, parseOrThrow(listSpacesSchema, query).today);
  }

  @Post()
  create(@UserId() userId: string, @Body() body: unknown) {
    return this.spaces.create(userId, parseOrThrow(createSpaceSchema, body));
  }

  @Put('order')
  reorder(@UserId() userId: string, @Body() body: unknown) {
    return this.spaces.reorder(userId, parseOrThrow(reorderSpacesSchema, body).ids);
  }

  @Put(':id/carry-over')
  setCarryOver(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.spaces.setCarryOver(userId, id, parseOrThrow(carryOverSchema, body).carryOver);
  }

  @Put(':id/parent')
  move(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.spaces.move(userId, id, parseOrThrow(moveSpaceSchema, body).parentId);
  }

  @Patch(':id')
  rename(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.spaces.rename(userId, id, parseOrThrow(renameSpaceSchema, body).title);
  }

  @Post(':id/duplicate')
  duplicate(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.spaces.duplicate(userId, id, parseOrThrow(duplicateSpaceSchema, body).id);
  }

  @Delete(':id')
  remove(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.spaces.remove(userId, id);
  }
}
