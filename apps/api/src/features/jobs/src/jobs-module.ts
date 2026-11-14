import { Module } from '@nestjs/common';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { JobsController } from './jobs-controller.ts';
import { JobsService } from './jobs-service.ts';

@Module({ imports: [SpacesModule, BudgetModule], controllers: [JobsController], providers: [JobsService] })
export class JobsModule {}
