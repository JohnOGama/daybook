'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Button } from '@/shared/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/shared/components/ui/context-menu';
import { cn } from '@/shared/utils/cn';
import { usePageMutations } from '../hooks/usePageMutations';
import { type NotebookPage, pageSnippet, pageTitle } from './page-types';

type PageRowProps = { page: NotebookPage; href: string; isActive: boolean };

function PageRow({ page, href, isActive }: PageRowProps) {
  const { remove } = usePageMutations();
  const [confirming, setConfirming] = useState(false);
  const snippet = pageSnippet(page.content);

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn('block rounded-lg px-2.5 py-2 hover:bg-accent', isActive && 'bg-muted')}
          >
            <span className="block truncate text-sm font-medium">{pageTitle(page)}</span>
            <span className="block truncate text-xs text-muted-foreground">{snippet || 'Empty page'}</span>
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setConfirming(true)}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this page?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{pageTitle(page)}&quot; will move to Trash. You can restore it from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate(page.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

type PageListProps = {
  title?: string;
  pages: NotebookPage[];
  activeId?: string;
  hrefOf: (id: string) => string;
  onAddPage: () => void;
};

export function PageListComponent({ title, pages, activeId, hrefOf, onAddPage }: PageListProps) {
  return (
    <section aria-label="Pages" className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onAddPage}>
        <Plus aria-hidden />
        Add page
      </Button>
      <ul className="flex flex-col gap-0.5">
        {pages.map((page) => (
          <PageRow key={page.id} page={page} href={hrefOf(page.id)} isActive={page.id === activeId} />
        ))}
      </ul>
    </section>
  );
}
