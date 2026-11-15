import { Injectable } from '@nestjs/common';

const LIMIT = 120;
const WINDOW_MS = 60_000;

// At most 120 reports a minute per space, so a runaway pipeline can't flood the database.
// ponytail: counts live in this process's memory, like the realtime rooms; a shared store if the API ever runs as several.
@Injectable()
export class ReportLimiter {
  private readonly hits = new Map<string, number[]>();
  now = () => Date.now();

  take(spaceId: string): boolean {
    const now = this.now();
    const recent = (this.hits.get(spaceId) ?? []).filter((at) => now - at < WINDOW_MS);
    if (recent.length >= LIMIT) {
      this.hits.set(spaceId, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(spaceId, recent);
    return true;
  }
}
