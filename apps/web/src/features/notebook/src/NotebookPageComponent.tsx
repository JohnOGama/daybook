'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton, SkeletonBox } from 'skullet/react';
import { useActiveSpace } from '@/features/spaces';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { EmptyNotebookIcon } from '@/shared/components/EmptyStateIconsComponent';
import { Button } from '@/shared/components/ui/button';
import { usePageMutations } from '../hooks/usePageMutations';
import { usePages } from '../hooks/usePages';
import { PageEditorComponent } from './PageEditorComponent';
import { PageListComponent } from './PageListComponent';
import type { NotebookPage } from './page-types';

const SAMPLE_PAGES: NotebookPage[] = ['Launch notes', 'Meeting notes', 'Handover'].map((title, index) => ({
  id: `sample-${index}`,
  title,
  content: null,
  createdAt: '',
}));

export function NotebookPageComponent() {
  const router = useRouter();
  const params = useSearchParams();
  const space = useActiveSpace();
  const { data, isPending, isError } = usePages();
  const { create } = usePageMutations();
  const pages = isPending ? SAMPLE_PAGES : (data ?? []);
  const active = pages.find(({ id }) => id === params.get('page')) ?? pages[0];
  const hrefOf = (pageId: string) => `/notebook?${new URLSearchParams({ space: space?.id ?? '', page: pageId })}`;

  function addPage() {
    router.replace(hrefOf(create()));
  }

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this notebook. Please try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col md:flex-row">
      <aside className="shrink-0 border-b md:sticky md:top-0 md:h-[calc(100dvh-1rem)] md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
        <Skeleton loading={isPending} label="Loading pages">
          <PageListComponent title={space?.title} pages={pages} activeId={active?.id} hrefOf={hrefOf} onAddPage={addPage} />
        </Skeleton>
      </aside>
      <div className="min-w-0 flex-1">
        {isPending && (
          <div role="status" aria-label="Loading page" className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-8 md:px-8">
            <SkeletonBox width="50%" height={32} />
            <SkeletonBox width="90%" height={16} />
            <SkeletonBox width="70%" height={16} />
          </div>
        )}
        {!isPending && active && <PageEditorComponent key={active.id} page={active} />}
        {!isPending && !active && (
          <EmptyStateComponent
            icon={<EmptyNotebookIcon />}
            title="This notebook has no pages"
            description="Add a page and start writing. It saves as you type."
            action={<Button onClick={addPage}>Add page</Button>}
          />
        )}
      </div>
    </div>
  );
}
