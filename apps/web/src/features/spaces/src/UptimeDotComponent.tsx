import { cn } from '@/shared/utils/cn';
import type { Space, UptimeStatus } from './space-types';

const LABEL: Record<UptimeStatus, string> = { up: 'all sites are up', slow: 'a site is slow', down: 'a site is down' };
const TONE: Record<UptimeStatus, string> = { up: 'bg-status-done', slow: 'bg-signal', down: 'bg-destructive' };

// The live status of an Uptime space at the end of its sidebar row; it changes the moment a check moves a site.
export function UptimeDotComponent({ space }: { space: Space }) {
  if (space.tool !== 'uptime' || !space.uptime) return null;
  return <span role="img" aria-label={`${space.title}, ${LABEL[space.uptime]}`} className={cn('ml-auto size-2 shrink-0 rounded-full', TONE[space.uptime])} />;
}
