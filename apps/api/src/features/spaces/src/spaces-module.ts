import { Module } from '@nestjs/common';
import { SpacesController } from './spaces-controller.ts';
import { SpacesService } from './spaces-service.ts';

@Module({ controllers: [SpacesController], providers: [SpacesService] })
export class SpacesModule {}
