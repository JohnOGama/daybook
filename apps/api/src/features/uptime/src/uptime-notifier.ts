import { Inject, Injectable } from '@nestjs/common';
import { RealtimeService } from '../../realtime/index.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { UptimeService } from './uptime-service.ts';

export const UPTIME_NOTIFIER = Symbol('UPTIME_NOTIFIER');

// Told when a check moves a site's status, so sidebars and open pages can follow.
export type UptimeNotifier = { changed(spaceId: string): Promise<void> };

// Pushes a space's dot to everyone who can see it, worked out now. Like the pipelines push, it carries no site details:
// an open page refetches through the checked read routes, so a locked space stays locked.
@Injectable()
export class RealtimeUptimeNotifier implements UptimeNotifier {
  constructor(
    @Inject(RealtimeService) private readonly realtime: Pick<RealtimeService, 'sendToUsers'>,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(UptimeService) private readonly uptime: UptimeService,
  ) {}

  async changed(spaceId: string): Promise<void> {
    const [viewers, status] = await Promise.all([this.access.viewerIds(spaceId), this.uptime.dotStatus(spaceId)]);
    if (viewers.length > 0) this.realtime.sendToUsers(viewers, { type: 'uptime', spaceId, status });
  }
}
