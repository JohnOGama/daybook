import { Module } from '@nestjs/common';
import { SpacesModule } from '../../spaces/index.ts';
import { NotebookController } from './notebook-controller.ts';
import { NotebookService } from './notebook-service.ts';

@Module({ imports: [SpacesModule], controllers: [NotebookController], providers: [NotebookService] })
export class NotebookModule {}
