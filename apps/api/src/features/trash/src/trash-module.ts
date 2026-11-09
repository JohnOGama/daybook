import { Module } from '@nestjs/common';
import { TrashController } from './trash-controller.ts';
import { TrashService } from './trash-service.ts';

@Module({ controllers: [TrashController], providers: [TrashService] })
export class TrashModule {}
