'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { useState } from 'react';
import { SkeletonBox } from 'skullet/react';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { type SaveStatus, usePageAutosave } from '../hooks/usePageAutosave';
import { EDITOR_EXTENSIONS } from './editor-extensions';
import type { NotebookPage } from './page-types';
import { SelectionToolbarComponent } from './SelectionToolbarComponent';

const STATUS_LABELS: Record<SaveStatus, string> = { saved: 'Saved', saving: 'Saving', failed: 'Not saved' };

export function PageEditorComponent({ page }: { page: NotebookPage }) {
  const { schedule, status } = usePageAutosave(page.id);
  const [title, setTitle] = useState(page.title);
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: page.content ?? '',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'page-content', 'aria-label': 'Page content' } },
    onUpdate: ({ editor: current }) => schedule({ content: current.getJSON() }),
  });

  return (
    <article className="mx-auto max-w-2xl px-4 py-6 pb-24 md:px-8 md:py-8">
      <div className="flex items-baseline justify-between gap-3">
        <Input
          aria-label="Page title"
          autoFocus={!page.title && !page.content}
          maxLength={200}
          placeholder="Untitled"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            schedule({ title: event.target.value });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') editor?.commands.focus('start');
          }}
          className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-[28px] dark:bg-transparent"
        />
        <span role="status" className={cn('shrink-0 text-[13px] text-muted-foreground', status === 'failed' && 'text-destructive')}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {editor ? (
        <>
          <EditorContent editor={editor} className="mt-4" />
          <SelectionToolbarComponent editor={editor} />
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <SkeletonBox width="90%" height={16} />
          <SkeletonBox width="70%" height={16} />
        </div>
      )}
    </article>
  );
}
