import { Body, Controller, Delete, ForbiddenException, Get, Inject, Param, ParseUUIDPipe, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AUTH, type Auth, AuthGuard, UserId } from '../../auth/index.ts';
import { SpaceAccessService } from './space-access-service.ts';
import { SpaceLockService, unlockCookieName } from './space-lock-service.ts';
import { removeLockSchema, setLockSchema, unlockSchema } from './space-schemas.ts';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
  path: '/api',
};

@UseGuards(AuthGuard)
@Controller('spaces/:id')
export class SpaceLockController {
  constructor(
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(AUTH) private readonly auth: Pick<Auth, 'api'>,
  ) {}

  @Get('unlock')
  async status(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    await this.access.resolve(userId, id, 'view');
    return { unlocked: await this.lock.isOpen(userId, id, request.headers.cookie) };
  }

  @Post('unlock')
  async unlock(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.access.resolve(userId, id, 'view');
    const token = await this.lock.unlock(userId, id, parseOrThrow(unlockSchema, body).password);
    response.cookie(unlockCookieName(id), token, cookieOptions);
  }

  @Delete('unlock')
  lockNow(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) response: Response) {
    response.clearCookie(unlockCookieName(id), cookieOptions);
  }

  @Put('lock')
  async setPassword(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { password, currentPassword } = parseOrThrow(setLockSchema, body);
    const token = await this.lock.setPassword(userId, id, password, currentPassword);
    response.cookie(unlockCookieName(id), token, cookieOptions);
  }

  @Delete('lock')
  async removePassword(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parseOrThrow(removeLockSchema, body);
    if ('password' in input) {
      await this.lock.removePassword(userId, id, input.password);
    } else {
      await this.assertAccountPassword(input.accountPassword, request);
      await this.lock.resetPassword(userId, id);
    }
    response.clearCookie(unlockCookieName(id), cookieOptions);
  }

  private async assertAccountPassword(password: string, request: Request): Promise<void> {
    try {
      await this.auth.api.verifyPassword({ body: { password }, headers: fromNodeHeaders(request.headers) });
    } catch {
      throw new ForbiddenException('That account password is not right');
    }
  }
}
