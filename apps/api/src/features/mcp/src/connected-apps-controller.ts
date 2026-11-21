import { Controller, Delete, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../../auth/index.ts';
import { ConnectedAppsService } from './connected-apps-service.ts';

@UseGuards(AuthGuard)
@Controller('connected-apps')
export class ConnectedAppsController {
  constructor(@Inject(ConnectedAppsService) private readonly apps: ConnectedAppsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.apps.list(userId);
  }

  @Delete(':id')
  disconnect(@UserId() userId: string, @Param('id') id: string) {
    return this.apps.disconnect(userId, id);
  }
}
