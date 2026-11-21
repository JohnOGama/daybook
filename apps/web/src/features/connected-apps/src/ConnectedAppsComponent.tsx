'use client';

import { Skeleton } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { formatShortDate } from '@/shared/utils/date-formatter';
import { useConnectedApps } from '../hooks/useConnectedApps';
import { SAMPLE_CONNECTED_APPS } from './sample-connected-apps';

const connectedOn = (iso: string) => `Connected ${formatShortDate(iso)} ${new Date(iso).getFullYear()}`;

export function ConnectedAppsComponent() {
  const { apps, isPending, isError, disconnect } = useConnectedApps();
  const rows = isPending ? SAMPLE_CONNECTED_APPS : (apps ?? []);

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your connected apps. Please try again.
      </p>
    );
  }

  if (!isPending && rows.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No apps connected yet.</p>;
  }

  return (
    <Skeleton loading={isPending} label="Loading connected apps">
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">App</TableHead>
              <TableHead className="hidden sm:table-cell">Connected</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="pl-4 font-medium">{app.name}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{connectedOn(app.connectedAt)}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Disconnect ${app.name}`}
                    onClick={() => disconnect(app)}
                  >
                    Disconnect
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Skeleton>
  );
}
