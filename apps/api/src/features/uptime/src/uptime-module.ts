import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../realtime/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { UptimeController } from './uptime-controller.ts';
import { RealtimeUptimeNotifier, UPTIME_NOTIFIER } from './uptime-notifier.ts';
import { realChecker, UPTIME_CHECKER, UptimeScheduler } from './uptime-scheduler.ts';
import { UptimeService } from './uptime-service.ts';

@Module({
  imports: [SpacesModule, RealtimeModule],
  controllers: [UptimeController],
  providers: [
    UptimeService,
    UptimeScheduler,
    { provide: UPTIME_CHECKER, useValue: realChecker },
    { provide: UPTIME_NOTIFIER, useClass: RealtimeUptimeNotifier },
  ],
})
export class UptimeModule {}
