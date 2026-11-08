import { Module } from '@nestjs/common';
import { AuthModule } from './features/auth/index.ts';
import { DbModule } from './shared/db/db-module.ts';

@Module({ imports: [DbModule, AuthModule] })
export class AppModule {}
