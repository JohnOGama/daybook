import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { MonitorStatusComponent } from './MonitorStatusComponent';
import { UptimeBarsComponent } from './UptimeBarsComponent';
import { formatDuration, formatResponse, formatUptime } from './uptime-math';
import type { MonitorRow } from './uptime-types';

function Reason({ site, now }: { site: MonitorRow; now: Date }) {
  if (site.paused || site.status !== 'down' || !site.lastError) return null;
  const since = site.downSince ? ` · down for ${formatDuration(now.getTime() - new Date(site.downSince).getTime())}` : '';
  return <p className="text-xs text-destructive">{`${site.lastError}${since}`}</p>;
}

export function MonitorTableComponent({ monitors, now, onOpen }: { monitors: MonitorRow[]; now: Date; onOpen: (id: string) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Status</TableHead>
          <TableHead>Site</TableHead>
          <TableHead className="hidden sm:table-cell">Response</TableHead>
          <TableHead className="hidden w-[34%] md:table-cell">Last 24 hours</TableHead>
          <TableHead className="text-right">24 h</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monitors.map((site) => (
          <TableRow key={site.id} className="cursor-pointer" onClick={() => onOpen(site.id)}>
            <TableCell>
              <MonitorStatusComponent status={site.status} paused={site.paused} responseMs={site.lastResponseMs} error={site.lastError} />
            </TableCell>
            <TableCell className="max-w-0 min-w-40">
              <button type="button" onClick={() => onOpen(site.id)} className="flex items-center gap-2 text-left font-semibold hover:underline">
                <span className="truncate">{site.name}</span>
                <span className="shrink-0 rounded-md border px-1.5 text-[11px] font-normal text-muted-foreground">{site.kind === 'api' ? 'API' : 'Web'}</span>
              </button>
              <p className="truncate font-mono text-xs text-muted-foreground">{site.url}</p>
              <Reason site={site} now={now} />
            </TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">{site.status === 'down' ? '—' : formatResponse(site.lastResponseMs)}</TableCell>
            <TableCell className="hidden md:table-cell">
              <UptimeBarsComponent bars={site.bars} now={now} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatUptime(site.uptime24h)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
