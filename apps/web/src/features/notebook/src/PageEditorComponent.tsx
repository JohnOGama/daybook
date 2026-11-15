'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import { History } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { SkeletonBox } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { type SaveStatus, usePageAutosave } from '../hooks/usePageAutosave';
import { BlockDragHandleComponent } from './BlockDragHandleComponent';
import { EDITOR_EXTENSIONS } from './editor-extensions';
import type { NotebookPage } from './page-types';
import { PageHistoryComponent } from './PageHistoryComponent';
import { SelectionToolbarComponent } from './SelectionToolbarComponent';

const STATUS_LABELS: Record<SaveStatus, string> = { saved: 'Saved', saving: 'Saving', failed: 'Not saved', conflict: 'Changed by someone else' };

type PageEditorProps = {
  page: NotebookPage;
  eyebrow?: string;
  titlePlaceholder?: string;
  footer?: ReactNode;
  improveWithAi?: boolean;
  canEdit?: boolean;
};

export function PageEditorComponent({ page, eyebrow, titlePlaceholder = 'Untitled', footer, improveWithAi, canEdit = true }: PageEditorProps) {
  const { schedule, status, reload } = usePageAutosave(page.id, page.version);
  const [title, setTitle] = useState(page.title);
  const [historyOpen, setHistoryOpen] = useState(false);
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: page.content ?? '',
    immediatelyRender: false,
    editable: canEdit,
    editorProps: { attributes: { class: 'page-content', 'aria-label': 'Page content' } },
    onUpdate: ({ editor: current }) => canEdit && schedule({ content: current.getJSON() }),
  });

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  async function handleReload() {
    const fresh = await reload();
    if (!fresh) return;
    setTitle(fresh.title);
    editor?.commands.setContent(fresh.content ?? '', { emitUpdate: false });
  }

  return (
    <article className={cn('mx-auto max-w-2xl px-4 py-6 pb-24 md:px-8 md:py-8', improveWithAi && 'md:pl-16')}>
      {eyebrow && <p className="mb-1 text-[13px] font-medium text-muted-foreground">{eyebrow}</p>}
      <div className="flex items-baseline justify-between gap-3">
        {canEdit ? (
        <Input
          aria-label="Page title"
          autoFocus={!page.title && !page.content}
          maxLength={200}
          placeholder={titlePlaceholder}
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
        ) : (
          <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight md:text-[28px]">{title || titlePlaceholder}</h2>
        )}
        {canEdit && (
          <span role="status" className={cn('shrink-0 text-[13px] text-muted-foreground', (status === 'failed' || status === 'conflict') && 'text-destructive')}>
            {STATUS_LABELS[status]}
          </span>
        )}
        {canEdit && status === 'conflict' && (
          <Button type="button" variant="outline" size="sm" className="shrink-0 self-center" onClick={handleReload}>
            Reload
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Version history"
          title="Version history"
          className="size-8 shrink-0 self-center text-muted-foreground"
          disabled={!editor}
          onClick={() => setHistoryOpen(true)}
        >
          <History aria-hidden />
        </Button>
      </div>
      {editor ? (
        <>
          <BlockDragHandleComponent editor={editor} improveWithAi={improveWithAi} canEdit={canEdit}>
            <EditorContent editor={editor} className="mt-4" />
          </BlockDragHandleComponent>
          {canEdit && <SelectionToolbarComponent editor={editor} improveWithAi={improveWithAi} />}
          {footer}
          <PageHistoryComponent pageId={page.id} editor={editor} open={historyOpen} onOpenChange={setHistoryOpen} canEdit={canEdit} />
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
