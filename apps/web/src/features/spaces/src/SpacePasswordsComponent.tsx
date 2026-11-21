'use client';

import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from 'skullet/react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { canLock, useSpaceLock, useSpaceUnlocked } from '../hooks/useSpaceLock';
import { useSpaces } from '../hooks/useSpaces';
import { type PasswordDialogMode, SpacePasswordDialogComponent } from './SpacePasswordDialogComponent';
import { TOOL_ICONS } from './SpacesNavComponent';
import { buildOwnTree } from './space-tree';
import { type Space, TOOLS } from './space-types';

const SAMPLE_SPACES: Space[] = ['Work', 'Journal', 'Side project'].map((title, index) => ({
  id: `sample-${index}`,
  parentId: null,
  kind: 'space',
  title,
  tool: 'list',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'sample',
  ownerName: null,
}));

type Row = { space: Space; folder?: string };

function lockableRows(spaces: Space[]): Row[] {
  return buildOwnTree(spaces).flatMap((node): Row[] =>
    node.kind === 'folder'
      ? node.children.filter((space) => canLock(space)).map((space) => ({ space, folder: node.title }))
      : canLock(node)
        ? [{ space: node }]
        : [],
  );
}

function PasswordRow({ space, folder }: Row) {
  const [mode, setMode] = useState<PasswordDialogMode>();
  const { lockNow } = useSpaceLock();
  const { data: unlocked } = useSpaceUnlocked(space);
  const ToolIcon = TOOL_ICONS[space.tool ?? 'list'] ?? TOOL_ICONS.list;
  const toolLabel = TOOLS.find(({ id }) => id === space.tool)?.label;
  const StatusIcon = unlocked ? LockKeyholeOpen : LockKeyhole;
  const status = space.locked ? (
    <span className="inline-flex items-center gap-1.5 text-foreground">
      <StatusIcon className="size-3.5" aria-hidden />
      {unlocked ? 'Unlocked here' : 'Locked'}
    </span>
  ) : (
    <span className="text-muted-foreground">No password</span>
  );

  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="py-3 pl-4">
        <div className="flex items-center gap-3">
          <ToolIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">
                {folder && <span className="font-normal text-muted-foreground">{folder} / </span>}
                {space.title}
              </span>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {toolLabel}
              </Badge>
            </div>
            <div className="mt-0.5 text-[13px] sm:hidden">{status}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden text-[13px] sm:table-cell">{status}</TableCell>
      <TableCell className="text-right">
        {space.locked && (
          <div className="flex justify-end gap-1">
            {unlocked && (
              <Button variant="ghost" size="sm" disabled={lockNow.isPending} onClick={() => lockNow.mutate(space.id)}>
                Lock now
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setMode('change')}>
              Change
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="w-16 pr-4 text-right">
        <Switch
          aria-label={`Password for ${space.title}`}
          checked={space.locked}
          onCheckedChange={(on) => setMode(on ? 'add' : 'remove')}
        />
        <SpacePasswordDialogComponent space={space} mode={mode} onClose={() => setMode(undefined)} />
      </TableCell>
    </TableRow>
  );
}

function LockAllCard({ spaces }: { spaces: Space[] }) {
  const { lockNow } = useSpaceLock();
  const locked = spaces.filter((space) => space.locked);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-medium">Lock all spaces</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Close every unlocked space in this browser, for when you step away.
        </p>
      </div>
      <Button
        variant="outline"
        className="shrink-0"
        disabled={locked.length === 0 || lockNow.isPending}
        onClick={() => {
          for (const space of locked) lockNow.mutate(space.id);
        }}
      >
        <LockKeyhole aria-hidden />
        Lock all
      </Button>
    </div>
  );
}

export function SpacePasswordsComponent() {
  const { data, isPending, isError } = useSpaces();
  const rows = lockableRows(isPending ? SAMPLE_SPACES : (data ?? []));

  if (isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your spaces. Please try again.
      </p>
    );
  }

  if (!isPending && rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        Spaces you create will show up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isPending} label="Loading spaces">
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Space</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
                <TableHead className="pr-4 text-right">Password</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <PasswordRow key={row.space.id} {...row} />
              ))}
            </TableBody>
          </Table>
        </div>
      </Skeleton>
      {!isPending && <LockAllCard spaces={rows.map(({ space }) => space)} />}
    </div>
  );
}
