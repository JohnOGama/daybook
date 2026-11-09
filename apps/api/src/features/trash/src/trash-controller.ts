import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { TrashService } from './trash-service.ts';

@UseGuards(AuthGuard)
@Controller('trash')
export class TrashController {
  constructor(@Inject(TrashService) private readonly trash: TrashService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.trash.list(userId);
  }

  @Post('tasks/:id/restore')
  restoreTask(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreTask(userId, id);
  }

  @Post('spaces/:id/restore')
  restoreSpace(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreSpace(userId, id);
  }
}
