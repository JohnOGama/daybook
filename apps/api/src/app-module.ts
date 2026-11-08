import { Module } from '@nestjs/common';
import { AuthModule } from './features/auth/index.ts';
import { TasksModule } from './features/tasks/index.ts';
import { DbModule } from './shared/db/db-module.ts';

@Module({ imports: [DbModule, AuthModule, TasksModule] })
export class AppModule {}
