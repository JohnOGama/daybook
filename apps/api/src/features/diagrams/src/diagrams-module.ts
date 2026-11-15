import { Module } from '@nestjs/common';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { DiagramsController } from './diagrams-controller.ts';
import { DiagramsService } from './diagrams-service.ts';

@Module({ imports: [SpacesModule, BudgetModule], controllers: [DiagramsController], providers: [DiagramsService], exports: [DiagramsService] })
export class DiagramsModule {}
