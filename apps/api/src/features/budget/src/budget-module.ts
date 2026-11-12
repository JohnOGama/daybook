import { Module } from '@nestjs/common';
import { SpacesModule } from '../../spaces/index.ts';
import { BudgetAiService } from './budget-ai-service.ts';
import { BudgetController } from './budget-controller.ts';
import { BudgetService } from './budget-service.ts';

@Module({ imports: [SpacesModule], controllers: [BudgetController], providers: [BudgetService, BudgetAiService] })
export class BudgetModule {}
