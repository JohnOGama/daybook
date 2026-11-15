import { Body, Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { pipelineRuns, spaces } from '../../../shared/db/schema.ts';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { BudgetAiService } from '../../budget/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { addedOnly } from './added-only.ts';
import { PipelineKeysService } from './pipeline-keys-service.ts';
import { instrumentSchema, spaceQuerySchema } from './pipelines-schemas.ts';
import { PipelinesService } from './pipelines-service.ts';

@UseGuards(AuthGuard)
@Controller('pipelines')
export class PipelinesController {
  constructor(
    @Inject(PipelinesService) private readonly pipelines: PipelinesService,
    @Inject(PipelineKeysService) private readonly keys: PipelineKeysService,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(BudgetAiService) private readonly ai: BudgetAiService,
    @Inject(DB) private readonly db: Db,
  ) {}

  @Get()
  async load(@UserId() userId: string, @Query() query: unknown, @Req() request: Request) {
    const { spaceId } = parseOrThrow(spaceQuerySchema, query);
    await this.access.resolve(userId, spaceId, 'view');
    await this.assertPipelinesSpace(spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.pipelines.load(spaceId);
  }

  @Get('runs/:id')
  async run(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    const { spaceId } = await this.access.resolveRow(userId, pipelineRuns, id, 'view');
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    return this.pipelines.run(id);
  }

  @Get(':spaceId/key')
  async keyStatus(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    await this.ownerOnly(userId, spaceId);
    return this.keys.status(spaceId);
  }

  @Post(':spaceId/key')
  async newKey(@UserId() userId: string, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    await this.ownerOnly(userId, spaceId);
    return { key: await this.keys.create(spaceId) };
  }

  // Returns the Jenkinsfile with reporting added; nothing is saved. Only the pasted text and Daybook's address go to the AI.
  @Post('ai/instrument')
  async instrument(@UserId() userId: string, @Body() body: unknown, @Req() request: Request) {
    const { spaceId, jenkinsfile } = parseOrThrow(instrumentSchema, body);
    await this.access.resolve(userId, spaceId, 'edit');
    await this.assertPipelinesSpace(spaceId);
    await this.lock.assertUnlocked(userId, spaceId, request.headers.cookie);
    // Reports go to the web origin, whose /api rewrite reaches this API.
    const daybookUrl = process.env.BETTER_AUTH_URL ?? '';
    return this.ai.instrumentJenkinsfile(jenkinsfile, daybookUrl, (text) => addedOnly(jenkinsfile, text));
  }

  // The key writes into the owner's space, so only the owner sees or replaces it; anyone else gets the usual 404.
  private async ownerOnly(userId: string, spaceId: string): Promise<void> {
    const { access } = await this.access.resolve(userId, spaceId, 'view');
    if (access !== 'owner') throw new NotFoundException('Space not found');
    await this.assertPipelinesSpace(spaceId);
  }

  private async assertPipelinesSpace(spaceId: string): Promise<void> {
    const [space] = await this.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.tool, 'pipelines'), isNull(spaces.deletedAt)));
    if (!space) throw new NotFoundException('Pipelines space not found');
  }
}
