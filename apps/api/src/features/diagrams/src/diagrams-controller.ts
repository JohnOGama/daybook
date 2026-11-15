import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { dbmlProblem } from './dbml-check.ts';
import { aiEditSchema, spaceQuerySchema } from './diagrams-schemas.ts';
import { DiagramsService } from './diagrams-service.ts';

@UseGuards(AuthGuard)
@Controller('diagrams')
export class DiagramsController {
  constructor(
    @Inject(DiagramsService) private readonly diagrams: DiagramsService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return { ...(await this.diagrams.load(ownerId, spaceId)), aiEnabled: this.ai.enabled };
  }

  // Returns the new DBML without saving it; the browser puts it into the live document, so Undo stays local.
  // There is no save route: diagrams change only through the live connection (features/realtime).
  @Post('ai/edit')
  async edit(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, dbml, prompt } = parseOrThrow(aiEditSchema, body);
    const { ownerId } = await this.access.resolve(userId, spaceId, 'edit');
    await this.diagrams.assertSpace(ownerId, spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.ai.editDiagram(dbml, prompt, dbmlProblem);
  }
}
