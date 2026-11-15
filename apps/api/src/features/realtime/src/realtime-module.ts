import { Module } from '@nestjs/common';
import { DiagramsModule } from '../../diagrams/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { RealtimeService } from './realtime-service.ts';

@Module({ imports: [SpacesModule, DiagramsModule], providers: [RealtimeService], exports: [RealtimeService] })
export class RealtimeModule {}
