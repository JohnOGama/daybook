import { Module } from '@nestjs/common';
import { NotebookController } from './notebook-controller.ts';
import { NotebookService } from './notebook-service.ts';

@Module({ controllers: [NotebookController], providers: [NotebookService] })
export class NotebookModule {}
