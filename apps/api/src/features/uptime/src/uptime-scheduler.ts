import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { SpaceAccessService } from '../../spaces/index.ts';
import { type CheckResult, checkWithRetry, isPublicUrl } from './check-site.ts';
import { UPTIME_NOTIFIER, type UptimeNotifier } from './uptime-notifier.ts';
import { UptimeService } from './uptime-service.ts';

export const UPTIME_CHECKER = Symbol('UPTIME_CHECKER');

// How a site is checked and whether its URL may be watched; swapped for a fake in tests.
export type UptimeChecker = { check(url: string): Promise<CheckResult>; isPublic(url: string): Promise<boolean> };
export const realChecker: UptimeChecker = { check: (url) => checkWithRetry(url), isPublic: (url) => isPublicUrl(url) };

const TICK_MS = 15_000;
const AT_ONCE = 5;
const PRUNE_EVERY_MS = 60 * 60_000;

type DueSite = { id: string; url: string; spaceId: string };

// One of Daybook's two background jobs (with interview reminders): checks every due site, a few at a time, in this API process.
// Rooms already tie the API to a single instance, so a timer here is enough; nothing is checked while the API is down.
@Injectable()
export class UptimeScheduler implements OnModuleInit, OnApplicationShutdown {
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly inFlight = new Set<string>();
  private running = false;
  private lastPrune = 0;

  constructor(
    @Inject(UptimeService) private readonly uptime: UptimeService,
    @Inject(UPTIME_CHECKER) private readonly checker: UptimeChecker,
    @Inject(UPTIME_NOTIFIER) private readonly notifier: UptimeNotifier,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
  ) {}

  onModuleInit(): void {
    if (process.env.VITEST) return;
    this.timer = setInterval(() => this.tick().catch((error) => console.error('Uptime checks failed', error)), TICK_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  // A tick that is still working (slow sites, many timeouts) makes the next ones skip, so at most five checks ever run at once.
  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runTick(now, Date.now());
    } finally {
      this.running = false;
    }
  }

  // Each site is recorded at the moment its own check starts: the tick's time plus however long it waited in the queue.
  private async runTick(now: Date, startedAt: number): Promise<void> {
    if (now.getTime() - this.lastPrune >= PRUNE_EVERY_MS) {
      this.lastPrune = now.getTime();
      await this.uptime.prune(now).catch((error) => console.error('Could not prune uptime history', error));
    }
    const due = (await this.uptime.due(now)).filter(({ id }) => !this.inFlight.has(id));
    const visible = new Map<string, boolean>();
    for (const { spaceId } of due) {
      if (!visible.has(spaceId)) visible.set(spaceId, (await this.access.viewerIds(spaceId)).length > 0);
    }
    const queue = due.filter(({ spaceId }) => visible.get(spaceId));
    for (const { id } of queue) this.inFlight.add(id);
    let next = 0;
    const worker = async () => {
      while (next < queue.length) await this.checkOne(queue[next++], new Date(now.getTime() + Date.now() - startedAt));
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
  }

  private async checkOne(site: DueSite, at: Date): Promise<void> {
    try {
      const recorded = await this.uptime.record(site.id, await this.checker.check(site.url), at);
      if (recorded?.changed) await this.notifier.changed(recorded.spaceId);
    } catch (error) {
      console.error('Could not check a site', error);
    } finally {
      this.inFlight.delete(site.id);
    }
  }
}
