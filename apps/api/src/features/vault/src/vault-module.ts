import { Module } from '@nestjs/common';
import { VaultController } from './vault-controller.ts';
import { VaultService } from './vault-service.ts';

@Module({ controllers: [VaultController], providers: [VaultService] })
export class VaultModule {}
