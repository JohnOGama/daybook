import { Body, Controller, Get, Inject, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceLockService } from '../../spaces/index.ts';
import { dbmlProblem } from './dbml-check.ts';
import { aiEditSchema, saveDiagramSchema, spaceQuerySchema } from './diagrams-schemas.ts';
import { DiagramsService } from './diagrams-service.ts';

@UseGuards(AuthGuard)
@Controller('diagrams')
export class DiagramsController {
  constructor(
    @Inject(DiagramsService) private readonly diagrams: DiagramsService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return { ...(await this.diagrams.load(userId, spaceId)), aiEnabled: this.ai.enabled };
  }

  @Put()
  save(@UserId() userId: string, @Body() body: unknown) {
    const { spaceId, ...diagram } = parseOrThrow(saveDiagramSchema, body);
    return this.diagrams.save(userId, spaceId, diagram);
  }

  // Returns the new DBML without saving it; the browser applies it and autosaves, so Undo stays local.
  @Post('ai/edit')
  async edit(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, dbml, prompt } = parseOrThrow(aiEditSchema, body);
    await this.diagrams.assertSpace(userId, spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.ai.editDiagram(dbml, prompt, dbmlProblem);
  }
}
