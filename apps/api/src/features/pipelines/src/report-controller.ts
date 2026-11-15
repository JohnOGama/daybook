import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Inject, Post, UnauthorizedException } from '@nestjs/common';
import express from 'express';
import { parseOrThrow } from '../../../shared/utils/parse-or-throw.ts';
import { PipelineKeysService } from './pipeline-keys-service.ts';
import { PIPELINES_NOTIFIER, type PipelinesNotifier } from './pipelines-notifier.ts';
import { reportSchema } from './pipelines-schemas.ts';
import { PipelinesService } from './pipelines-service.ts';
import { ReportLimiter } from './report-limiter.ts';

export const REPORT_PATH = '/api/pipelines/report';
// Reports are small; this keeps a long error text (8,000 characters) well inside the limit.
export const reportBodyParser = () => express.json({ limit: '64kb' });

// Called by CI, not a browser: the key is the whole credential, so there is no session, Origin or space-password check.
@Controller('pipelines')
export class ReportController {
  constructor(
    @Inject(PipelineKeysService) private readonly keys: PipelineKeysService,
    @Inject(PipelinesService) private readonly pipelines: PipelinesService,
    @Inject(ReportLimiter) private readonly limiter: ReportLimiter,
    @Inject(PIPELINES_NOTIFIER) private readonly notifier: PipelinesNotifier,
  ) {}

  @Post('report')
  @HttpCode(HttpStatus.ACCEPTED)
  async report(@Headers('authorization') authorization: string | undefined, @Body() body: unknown): Promise<void> {
    const key = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1];
    const target = key ? await this.keys.spaceFor(key) : null;
    // One answer for every bad key, so a caller learns nothing about which part was wrong.
    if (!target) throw new UnauthorizedException();
    if (!this.limiter.take(target.spaceId)) throw new HttpException('Too many reports. Try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
    const report = parseOrThrow(reportSchema, body);
    await this.pipelines.report(target.ownerId, target.spaceId, report);
    // A failed push must not fail the report: the pipeline already did its part.
    await this.notifier.changed(target.spaceId).catch((error) => console.error('Could not push a pipeline update', error));
  }
}
