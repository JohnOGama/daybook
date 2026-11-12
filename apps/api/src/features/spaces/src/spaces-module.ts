import { Module } from '@nestjs/common';
import { SpaceLockController } from './space-lock-controller.ts';
import { SpaceLockService } from './space-lock-service.ts';
import { SpacesController } from './spaces-controller.ts';
import { SpacesService } from './spaces-service.ts';

@Module({
  controllers: [SpacesController, SpaceLockController],
  providers: [SpacesService, SpaceLockService],
  exports: [SpaceLockService],
})
export class SpacesModule {}
