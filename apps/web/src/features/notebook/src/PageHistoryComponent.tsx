'use client';

import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import { Skeleton, SkeletonBox } from 'skullet/react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { DrawerCloseButtonComponent } from '@/shared/components/DrawerCloseButtonComponent';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer';
import { cn } from '@/shared/utils/cn';
import { usePageVersion, usePageVersions } from '../hooks/usePageVersions';
import { diffLines, pageLines } from './page-diff';
import { checkpointPage } from './pages-api';
import type { PageVersion } from './page-types';

const SAMPLE_VERSIONS: PageVersion[] = [0, 1, 2].map((index) => ({ id: `sample-${index}`, createdAt: '2026-01-01T09:00:00Z' }));
const MARKS = { same: ' ', added: '+', removed: '−' };
const LABELS = { same: 'Unchanged', added: 'Added since', removed: 'Removed since' };

const formatMoment = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

type PageHistoryProps = { pageId: string; editor: Editor; open: boolean; onOpenChange: (open: boolean) => void };

export function PageHistoryComponent({ pageId, editor, open, onOpenChange }: PageHistoryProps) {
  const versions = usePageVersions(pageId, open);
  const [picked, setPicked] = useState<string>();
  const [restoring, setRestoring] = useState(false);
  const list = versions.isPending ? SAMPLE_VERSIONS : (versions.data ?? []);
  const selectedId = versions.data?.find(({ id }) => id === picked)?.id ?? versions.data?.at(0)?.id;
  const version = usePageVersion(pageId, open ? selectedId : undefined);
  const changes = version.data ? diffLines(pageLines(version.data.content), pageLines(editor.getJSON())) : [];
  const changed = changes.some(({ kind }) => kind !== 'same');

  async function restore() {
    if (!version.data) return;
    setRestoring(true);
    try {
      // Keep what is there now first, so a restore can itself be undone from this list.
      await checkpointPage(pageId);
      editor.commands.insertContentAt({ from: 0, to: editor.state.doc.content.size }, version.data.content.content ?? []);
      toast.success('Version restored', { action: { label: 'Undo', onClick: () => editor.commands.undo() } });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That version could not be restored. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="gap-0 data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-lg">
        <DrawerCloseButtonComponent />
        <DrawerHeader className="pr-12">
          <DrawerTitle>Version history</DrawerTitle>
          <DrawerDescription>A copy is kept as you edit, about every ten minutes. Pick one to see what has changed since.</DrawerDescription>
        </DrawerHeader>

        {versions.isError && (
          <p role="alert" className="px-4 text-sm text-destructive">
            Could not load the history. Please try again.
          </p>
        )}
        {versions.data?.length === 0 && (
          <p className="px-4 text-sm text-muted-foreground">No earlier versions yet. The first one is kept the next time you edit this page.</p>
        )}

        {!versions.isError && list.length > 0 && (
          <>
            <Skeleton loading={versions.isPending} label="Loading versions">
              <ul aria-label="Versions" className="mx-4 flex max-h-44 shrink-0 flex-col overflow-y-auto rounded-lg border p-1">
                {list.map(({ id, createdAt }) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={id === selectedId}
                      onClick={() => setPicked(id)}
                      className={cn(
                        'w-full rounded-md px-2.5 py-1.5 text-left text-sm tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                        id === selectedId && 'bg-accent font-medium',
                      )}
                    >
                      {formatMoment(createdAt)}
                    </button>
                  </li>
                ))}
              </ul>
            </Skeleton>

            <h3 className="px-4 pt-4 pb-2 text-sm font-semibold">Changes since this version</h3>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {version.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Could not load this version. Please try again.
                </p>
              )}
              {(versions.isPending || version.isPending) && !version.isError && (
                <div role="status" aria-label="Loading changes" className="flex flex-col gap-2.5">
                  <SkeletonBox width="92%" height={14} />
                  <SkeletonBox width="78%" height={14} />
                  <SkeletonBox width="85%" height={14} />
                </div>
              )}
              {version.data && !changed && <p className="text-sm text-muted-foreground">Nothing has changed since this version.</p>}
              {version.data && changed && (
                <ul className="flex flex-col gap-1 text-sm leading-relaxed">
                  {changes.map(({ kind, text }, index) => (
                    <li
                      key={index}
                      className={cn(
                        'flex gap-2 rounded-md px-2 py-1',
                        kind === 'same' && 'text-muted-foreground',
                        kind === 'added' && 'bg-accent',
                        kind === 'removed' && 'text-destructive line-through decoration-destructive/50',
                      )}
                    >
                      <span aria-label={LABELS[kind]} className="w-3 shrink-0 text-center no-underline select-none">
                        {MARKS[kind]}
                      </span>
                      <span className="min-w-0 break-words">{text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DrawerFooter>
              <Button onClick={restore} disabled={!version.data || !changed || restoring}>
                Restore this version
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
