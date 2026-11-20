import { Module } from '@nestjs/common';
import { SpaceAccessService } from './space-access-service.ts';
import { SpaceGroupsController } from './space-groups-controller.ts';
import { SpaceGroupsService } from './space-groups-service.ts';
import { SpaceLockController } from './space-lock-controller.ts';
import { SpaceLockService } from './space-lock-service.ts';
import { SpacesController } from './spaces-controller.ts';
import { SpacesService } from './spaces-service.ts';

@Module({
  controllers: [SpacesController, SpaceLockController, SpaceGroupsController],
  providers: [SpacesService, SpaceLockService, SpaceAccessService, SpaceGroupsService],
  exports: [SpaceLockService, SpaceAccessService],
})
export class SpacesModule {}
