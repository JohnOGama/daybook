'use client';

import { type Editor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  ArrowLeft,
  Bold,
  Check,
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Pilcrow,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  TextQuote,
  Underline,
} from 'lucide-react';
import { type FormEvent, type MouseEvent, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';

type BlockType = { id: string; label: string; Icon: LucideIcon; isActive: (editor: Editor) => boolean; apply: (editor: Editor) => void };

const heading = (level: 1 | 2 | 3, Icon: LucideIcon): BlockType => ({
  id: `h${level}`,
  label: `Heading ${level}`,
  Icon,
  isActive: (editor) => editor.isActive('heading', { level }),
  apply: (editor) => editor.chain().focus().clearNodes().setHeading({ level }).run(),
});

const BLOCK_TYPES: BlockType[] = [
  {
    id: 'text',
    label: 'Text',
    Icon: Pilcrow,
    isActive: (editor) => editor.isActive('paragraph'),
    apply: (editor) => editor.chain().focus().clearNodes().run(),
  },
  heading(1, Heading1),
  heading(2, Heading2),
  heading(3, Heading3),
  {
    id: 'bullets',
    label: 'Bulleted list',
    Icon: List,
    isActive: (editor) => editor.isActive('bulletList'),
    apply: (editor) => editor.chain().focus().clearNodes().toggleBulletList().run(),
  },
  {
    id: 'numbers',
    label: 'Numbered list',
    Icon: ListOrdered,
    isActive: (editor) => editor.isActive('orderedList'),
    apply: (editor) => editor.chain().focus().clearNodes().toggleOrderedList().run(),
  },
  {
    id: 'todos',
    label: 'To-do list',
    Icon: ListTodo,
    isActive: (editor) => editor.isActive('taskList'),
    apply: (editor) => editor.chain().focus().clearNodes().toggleTaskList().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    Icon: TextQuote,
    isActive: (editor) => editor.isActive('blockquote'),
    apply: (editor) => editor.chain().focus().clearNodes().toggleBlockquote().run(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    Icon: SquareCode,
    isActive: (editor) => editor.isActive('codeBlock'),
    apply: (editor) => editor.chain().focus().clearNodes().toggleCodeBlock().run(),
  },
];

const currentBlockIn = (editor: Editor) =>
  BLOCK_TYPES.find((block) => block.id !== 'text' && block.isActive(editor)) ?? BLOCK_TYPES[0];

type MarkButtonProps = { label: string; Icon: LucideIcon; active?: boolean; onClick: () => void };

function MarkButton({ label, Icon, active, onClick }: MarkButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      className={cn('size-9', active && 'bg-accent')}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </Button>
  );
}

const hrefFrom = (value: string) => (/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);

function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [url, setUrl] = useState<string>(editor.getAttributes('link').href ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = url.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (value) chain.setLink({ href: hrefFrom(value) }).run();
    else chain.unsetLink().run();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1 p-0.5">
      <Input
        autoFocus
        aria-label="Link address"
        placeholder="Paste a link"
        className="h-9"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDone();
        }}
      />
      <Button type="submit" variant="ghost" size="icon" aria-label="Apply link" className="size-9 shrink-0">
        <Check aria-hidden />
      </Button>
    </form>
  );
}

function BlockTypeList({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const current = currentBlockIn(editor).id;
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onDone}>
        <ArrowLeft aria-hidden />
        Turn into
      </Button>
      <div className="my-1 border-t" />
      {BLOCK_TYPES.map(({ id, label, Icon, apply }) => (
        <Button
          key={id}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={id === current}
          className="w-full justify-start"
          onClick={() => {
            apply(editor);
            onDone();
          }}
        >
          <Icon aria-hidden />
          {label}
          {id === current && <Check className="ml-auto" aria-hidden />}
        </Button>
      ))}
    </>
  );
}

export function SelectionPanel({ editor }: { editor: Editor }) {
  const [view, setView] = useState<'marks' | 'blocks' | 'link'>('marks');
  const showMarks = () => setView('marks');

  useEffect(() => {
    const backToMarks = () => setView('marks');
    editor.on('selectionUpdate', backToMarks);
    return () => {
      editor.off('selectionUpdate', backToMarks);
    };
  }, [editor]);

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      block: currentBlockIn(current),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      link: current.isActive('link'),
    }),
  });

  // Clicking a button must not take the highlight away from the text it formats.
  function keepSelection(event: MouseEvent) {
    if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
  }

  return (
    <div
      role="toolbar"
      aria-label="Format selection"
      data-slot="popover-content"
      onMouseDown={keepSelection}
      className="w-48 rounded-xl border bg-popover p-1 text-popover-foreground"
    >
      {view === 'link' && <LinkForm editor={editor} onDone={showMarks} />}
      {view === 'blocks' && <BlockTypeList editor={editor} onDone={showMarks} />}
      {view === 'marks' && (
        <>
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => setView('blocks')}>
            <active.block.Icon aria-hidden />
            {active.block.label}
            <ChevronRight className="ml-auto" aria-hidden />
          </Button>
          <div className="my-1 border-t" />
          <div className="grid grid-cols-4 gap-0.5 justify-items-center">
            <MarkButton label="Bold" Icon={Bold} active={active.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
            <MarkButton label="Italic" Icon={Italic} active={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
            <MarkButton label="Underline" Icon={Underline} active={active.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} />
            <MarkButton label="Clear formatting" Icon={RemoveFormatting} onClick={() => editor.chain().focus().unsetAllMarks().run()} />
            <MarkButton label="Link" Icon={Link} active={active.link} onClick={() => setView('link')} />
            <MarkButton label="Strikethrough" Icon={Strikethrough} active={active.strike} onClick={() => editor.chain().focus().toggleStrike().run()} />
            <MarkButton label="Inline code" Icon={Code} active={active.code} onClick={() => editor.chain().focus().toggleCode().run()} />
          </div>
        </>
      )}
    </div>
  );
}

export function SelectionToolbarComponent({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.body}
      className="z-50"
      options={{ placement: 'bottom-start', offset: 8, flip: true, shift: { padding: 8 } }}
    >
      <SelectionPanel editor={editor} />
    </BubbleMenu>
  );
}
