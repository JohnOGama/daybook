import { Module } from '@nestjs/common';
import { FitnessModule } from '../../fitness/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { ConnectedAppsController } from './connected-apps-controller.ts';
import { ConnectedAppsService } from './connected-apps-service.ts';
import { FitnessMcpTools } from './fitness-mcp-tools.ts';
import { McpEndpoint } from './mcp-endpoint.ts';

@Module({
  imports: [SpacesModule, FitnessModule],
  controllers: [ConnectedAppsController],
  providers: [FitnessMcpTools, McpEndpoint, ConnectedAppsService],
})
export class McpModule {}
