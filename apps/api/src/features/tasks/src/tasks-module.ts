import { Module } from '@nestjs/common';
import { SpacesModule } from '../../spaces/index.ts';
import { TasksController } from './tasks-controller.ts';
import { TasksService } from './tasks-service.ts';

@Module({ imports: [SpacesModule], controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
