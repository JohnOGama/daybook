import { Module } from '@nestjs/common';
import { SpacesModule } from '../../spaces/index.ts';
import { TrashController } from './trash-controller.ts';
import { TrashService } from './trash-service.ts';

@Module({ imports: [SpacesModule], controllers: [TrashController], providers: [TrashService] })
export class TrashModule {}
