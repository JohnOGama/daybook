import { Module } from '@nestjs/common';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { NotebookController } from './notebook-controller.ts';
import { NotebookService } from './notebook-service.ts';

@Module({ imports: [SpacesModule, BudgetModule], controllers: [NotebookController], providers: [NotebookService] })
export class NotebookModule {}
