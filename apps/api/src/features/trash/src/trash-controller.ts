import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { readCookies, SpaceLockService } from '../../spaces/index.ts';
import { TrashService } from './trash-service.ts';

@UseGuards(AuthGuard)
@Controller('trash')
export class TrashController {
  constructor(
    @Inject(TrashService) private readonly trash: TrashService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
  ) {}

  @Get()
  list(@UserId() userId: string, @Req() request: Request) {
    const cookies = readCookies(request.headers.cookie);
    return this.trash.list(userId, (space) => this.lock.isUnlocked(userId, space, cookies));
  }

  @Post('tasks/:id/restore')
  restoreTask(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreTask(userId, id);
  }

  @Post('pages/:id/restore')
  restorePage(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restorePage(userId, id);
  }

  @Post('vault-items/:id/restore')
  restoreVaultItem(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreVaultItem(userId, id);
  }

  @Post('spaces/:id/restore')
  restoreSpace(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trash.restoreSpace(userId, id);
  }
}
