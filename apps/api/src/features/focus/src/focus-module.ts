import { Module } from '@nestjs/common';
import { SpacesModule } from '../../spaces/index.ts';
import { FocusController } from './focus-controller.ts';
import { FocusService } from './focus-service.ts';

@Module({ imports: [SpacesModule], controllers: [FocusController], providers: [FocusService] })
export class FocusModule {}
