import { Module } from '@nestjs/common';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { SecurityController } from './security-controller.ts';
import { SecurityService } from './security-service.ts';

@Module({
  imports: [SpacesModule, BudgetModule],
  controllers: [SecurityController],
  providers: [SecurityService],
})
export class SecurityModule {}
