import { Module } from '@nestjs/common';
import { AuthModule } from './features/auth/index.ts';
import { BudgetModule } from './features/budget/index.ts';
import { FitnessModule } from './features/fitness/index.ts';
import { DiagramsModule } from './features/diagrams/index.ts';
import { HealthController } from './features/health/index.ts';
import { JobsModule } from './features/jobs/index.ts';
import { McpModule } from './features/mcp/index.ts';
import { NotebookModule } from './features/notebook/index.ts';
import { PipelinesModule } from './features/pipelines/index.ts';
import { RealtimeModule } from './features/realtime/index.ts';
import { VaultModule } from './features/vault/index.ts';
import { SpacesModule } from './features/spaces/index.ts';
import { TasksModule } from './features/tasks/index.ts';
import { TrashModule } from './features/trash/index.ts';
import { UptimeModule } from './features/uptime/index.ts';
import { FocusModule } from './features/focus/index.ts';
import { DbModule } from './shared/db/db-module.ts';

@Module({ imports: [DbModule, AuthModule, SpacesModule, TasksModule, NotebookModule, VaultModule, BudgetModule, FitnessModule, JobsModule, DiagramsModule, TrashModule, RealtimeModule, PipelinesModule, UptimeModule, FocusModule, McpModule], controllers: [HealthController] })
export class AppModule {}
