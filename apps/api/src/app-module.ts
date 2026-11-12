import { Module } from '@nestjs/common';
import { AuthModule } from './features/auth/index.ts';
import { BudgetModule } from './features/budget/index.ts';
import { NotebookModule } from './features/notebook/index.ts';
import { VaultModule } from './features/vault/index.ts';
import { SpacesModule } from './features/spaces/index.ts';
import { TasksModule } from './features/tasks/index.ts';
import { TrashModule } from './features/trash/index.ts';
import { DbModule } from './shared/db/db-module.ts';

@Module({ imports: [DbModule, AuthModule, SpacesModule, TasksModule, NotebookModule, VaultModule, BudgetModule, TrashModule] })
export class AppModule {}
