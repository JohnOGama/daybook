import { Inject, Injectable } from '@nestjs/common';
import { RealtimeService } from '../../realtime/index.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { PipelinesService } from './pipelines-service.ts';

export const PIPELINES_NOTIFIER = Symbol('PIPELINES_NOTIFIER');

// Told after every stored report, so open screens can update.
export type PipelinesNotifier = { changed(spaceId: string): Promise<void> };

// Pushes a space's new dot status to everyone who can see it, worked out now, not when they connected.
// The message carries no run content: an open page refetches through the checked read routes, so a locked space stays locked.
@Injectable()
export class RealtimePipelinesNotifier implements PipelinesNotifier {
  constructor(
    @Inject(RealtimeService) private readonly realtime: Pick<RealtimeService, 'sendToUsers'>,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(PipelinesService) private readonly pipelines: PipelinesService,
  ) {}

  async changed(spaceId: string): Promise<void> {
    const [viewers, status] = await Promise.all([this.access.viewerIds(spaceId), this.pipelines.dotStatus(spaceId)]);
    if (viewers.length > 0) this.realtime.sendToUsers(viewers, { type: 'pipeline', spaceId, status });
  }
}
