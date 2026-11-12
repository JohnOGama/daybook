'use client';

import { ArrowRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton, SkeletonBox } from 'skullet/react';
import { type NotebookPage, PageEditorComponent, usePageMutations, usePages } from '@/features/notebook';
import { useActiveSpace } from '@/features/spaces';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { EmptyBookIcon } from '@/shared/components/EmptyStateIconsComponent';
import { Button } from '@/shared/components/ui/button';
import { BookReaderComponent } from './BookReaderComponent';
import { ChapterOutlineComponent } from './ChapterOutlineComponent';
import { chapterTitle } from './book-stats';

const SAMPLE_CHAPTERS: NotebookPage[] = ['The beginning', 'A long way home', 'What we found'].map((title, index) => ({
  id: `sample-${index}`,
  title,
  content: null,
  createdAt: '',
}));

export function BookPageComponent() {
  const router = useRouter();
  const params = useSearchParams();
  const space = useActiveSpace();
  const { data, isPending, isError } = usePages();
  const { create } = usePageMutations();
  const chapters = isPending ? SAMPLE_CHAPTERS : (data ?? []);
  const activeIndex = Math.max(0, chapters.findIndex(({ id }) => id === params.get('page')));
  const active = chapters.at(activeIndex);
  const next = chapters.at(activeIndex + 1);
  const hrefOf = (query: Record<string, string> = {}) => `/book?${new URLSearchParams({ space: space?.id ?? '', ...query })}`;
  const chapterHref = (page: string) => hrefOf({ page });
  const shownId = isPending ? undefined : active?.id;
  const view = params.get('view');

  // Keep the open chapter in the URL, so reordering chapters can't swap it for whichever is now first.
  useEffect(() => {
    if (shownId && params.get('page') !== shownId) router.replace(hrefOf({ page: shownId, ...(view ? { view } : {}) }));
  });

  function addChapter() {
    router.replace(chapterHref(create()));
  }

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this book. Please try again.
      </p>
    );
  }

  if (!isPending && active && params.get('view') === 'read') {
    return <BookReaderComponent title={space?.title ?? ''} chapters={chapters} backHref={chapterHref(active.id)} />;
  }

  return (
    <div className="flex flex-col md:flex-row">
      <aside className="shrink-0 border-b md:sticky md:top-0 md:h-[calc(100dvh-1rem)] md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
        <Skeleton loading={isPending} label="Loading chapters">
          <ChapterOutlineComponent
            title={space?.title}
            chapters={chapters}
            activeId={active?.id}
            isPending={isPending}
            chapterHref={chapterHref}
            readHref={hrefOf({ view: 'read', ...(active ? { page: active.id } : {}) })}
            onAddChapter={addChapter}
          />
        </Skeleton>
      </aside>
      <div className="min-w-0 flex-1">
        {isPending && (
          <div role="status" aria-label="Loading chapter" className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-8 md:px-8">
            <SkeletonBox width={80} height={14} />
            <SkeletonBox width="50%" height={32} />
            <SkeletonBox width="90%" height={16} />
            <SkeletonBox width="70%" height={16} />
          </div>
        )}
        {!isPending && active && (
          <PageEditorComponent
            key={active.id}
            page={active}
            eyebrow={`Chapter ${activeIndex + 1}`}
            titlePlaceholder="Untitled chapter"
            footer={
              <div className="mt-16 flex justify-end border-t pt-4">
                {next ? (
                  <Button asChild variant="ghost">
                    <Link href={chapterHref(next.id)}>
                      <span className="max-w-60 truncate">Next: {chapterTitle(next)}</span>
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={addChapter}>
                    <Plus aria-hidden />
                    Add chapter {chapters.length + 1}
                  </Button>
                )}
              </div>
            }
          />
        )}
        {!isPending && !active && (
          <EmptyStateComponent
            icon={<EmptyBookIcon />}
            title="Start your book"
            description="Write it one chapter at a time. Everything saves as you type, and you can reorder chapters whenever you like."
            action={<Button onClick={addChapter}>Write chapter 1</Button>}
          />
        )}
      </div>
    </div>
  );
}
