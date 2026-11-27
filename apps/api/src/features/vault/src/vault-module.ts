import { Module } from '@nestjs/common';
import { SpacesModule } from '../../spaces/index.ts';
import { VaultController } from './vault-controller.ts';
import { VaultService } from './vault-service.ts';

@Module({ imports: [SpacesModule], controllers: [VaultController], providers: [VaultService] })
export class VaultModule {}
