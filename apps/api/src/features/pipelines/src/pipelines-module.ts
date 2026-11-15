import { Module } from '@nestjs/common';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { PipelineKeysService } from './pipeline-keys-service.ts';
import { PipelinesController } from './pipelines-controller.ts';
import { PIPELINES_NOTIFIER } from './pipelines-notifier.ts';
import { PipelinesService } from './pipelines-service.ts';
import { ReportController } from './report-controller.ts';
import { ReportLimiter } from './report-limiter.ts';

@Module({
  imports: [SpacesModule, BudgetModule],
  controllers: [PipelinesController, ReportController],
  providers: [PipelinesService, PipelineKeysService, ReportLimiter, { provide: PIPELINES_NOTIFIER, useValue: { changed: async () => undefined } }],
})
export class PipelinesModule {}
