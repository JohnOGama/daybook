import { Module } from '@nestjs/common';
import { AuthModule } from './features/auth/index.ts';
import { SpacesModule } from './features/spaces/index.ts';
import { TasksModule } from './features/tasks/index.ts';
import { TrashModule } from './features/trash/index.ts';
import { DbModule } from './shared/db/db-module.ts';

@Module({ imports: [DbModule, AuthModule, SpacesModule, TasksModule, TrashModule] })
export class AppModule {}
