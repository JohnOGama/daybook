'use client';

import { NodeSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { GripVertical, Sparkles } from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/components/ui/popover';
import { useAiRewrite } from '../hooks/useAiRewrite';
import { AiRewriteMenuComponent } from './AiRewriteMenuComponent';

const HANDLE_SIZE = 28;
const LIST_ITEMS = ['listItem', 'taskItem'];

type Target = { pos: number; top: number };

// The block under the pointer: the innermost list item, or else the top-level block.
function blockAt(editor: Editor, clientX: number, clientY: number): number | null {
  const { view } = editor;
  const box = view.dom.getBoundingClientRect();
  const left = Math.min(Math.max(clientX, box.left + 1), box.right - 1);
  const found = view.posAtCoords({ left, top: clientY });
  if (!found) return null;
  const $pos = view.state.doc.resolve(found.pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (depth === 1 || LIST_ITEMS.includes($pos.node(depth).type.name)) return $pos.before(depth);
  }
  if ($pos.nodeAfter) return found.pos;
  return $pos.nodeBefore ? found.pos - $pos.nodeBefore.nodeSize : null;
}

// The prose the AI may rewrite: the block itself, or the first line of a list item or quote. Never code.
function proseAt(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  const prose = node?.isTextblock ? { pos, node } : node?.firstChild?.isTextblock ? { pos: pos + 1, node: node.firstChild } : null;
  return prose && !prose.node.type.spec.code && prose.node.textContent.trim() ? prose : null;
}

type BlockDragHandleProps = { editor: Editor; improveWithAi?: boolean; children: ReactNode };

export function BlockDragHandleComponent({ editor, improveWithAi, children }: BlockDragHandleProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const ai = useAiRewrite(editor);
  // The handle stays on its block while that block's menu is open.
  const pinned = useRef(false);
  pinned.current = menuOpen;

  useEffect(() => {
    const hide = () => {
      if (!pinned.current) setTarget(null);
    };
    editor.on('update', hide);
    return () => {
      editor.off('update', hide);
    };
  }, [editor]);

  const follow = (clientX: number, clientY: number) => {
    if (menuOpen) return;
    const pos = blockAt(editor, clientX, clientY);
    const block = pos === null ? null : editor.view.nodeDOM(pos);
    if (pos === null || !(block instanceof HTMLElement) || !wrapper.current) return setTarget(null);
    const lineHeight = parseFloat(getComputedStyle(block).lineHeight) || HANDLE_SIZE;
    const top = block.getBoundingClientRect().top - wrapper.current.getBoundingClientRect().top + (lineHeight - HANDLE_SIZE) / 2;
    setTarget((current) => (current?.pos === pos && current.top === top ? current : { pos, top }));
  };

  const select = (pos: number) => {
    const selection = NodeSelection.create(editor.state.doc, pos);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    return selection;
  };

  // ProseMirror moves whatever `view.dragging` holds when the drop lands inside the editor.
  const startDrag = (event: DragEvent, pos: number) => {
    const selection = select(pos);
    const slice = selection.content();
    const block = editor.view.nodeDOM(pos);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.setData('text/plain', slice.content.textBetween(0, slice.content.size, '\n'));
    if (block instanceof HTMLElement) event.dataTransfer.setDragImage(block, 0, 0);
    editor.view.dragging = { slice, move: true, node: selection } as typeof editor.view.dragging;
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setTarget(null);
  };

  const rewrite = async (pos: number, instruction: string) => {
    const prose = proseAt(editor, pos);
    if (prose) await ai.rewrite({ from: prose.pos + 1, to: prose.pos + prose.node.nodeSize - 1 }, instruction);
    closeMenu();
  };

  const canRewrite = target !== null && proseAt(editor, target.pos) !== null;

  return (
    <div ref={wrapper} className="relative" onMouseMove={(event) => follow(event.clientX, event.clientY)} onMouseLeave={() => !menuOpen && setTarget(null)}>
      {children}
      {target && (
        <Popover open={menuOpen} onOpenChange={(open) => !open && !ai.isPending && closeMenu()}>
          <PopoverAnchor asChild>
            <div
              style={{ top: target.top, left: improveWithAi ? -2 * HANDLE_SIZE : -HANDLE_SIZE, height: HANDLE_SIZE }}
              className="absolute hidden text-muted-foreground/60 md:flex"
            >
              {improveWithAi && (
                <button
                  type="button"
                  aria-label="Improve this block with AI"
                  title="Improve with AI"
                  onClick={() => {
                    select(target.pos);
                    setMenuOpen(true);
                  }}
                  style={{ width: HANDLE_SIZE }}
                  className="grid place-items-center rounded-md outline-none hover:bg-accent hover:text-signal focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Sparkles className="size-4" aria-hidden />
                </button>
              )}
              <div
                aria-hidden
                draggable
                title="Drag to move"
                onClick={() => select(target.pos)}
                onDragStart={(event) => startDrag(event, target.pos)}
                onDragEnd={() => {
                  editor.view.dragging = null;
                  setTarget(null);
                }}
                style={{ width: HANDLE_SIZE }}
                className="grid cursor-grab place-items-center rounded-md hover:bg-accent hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </div>
            </div>
          </PopoverAnchor>
          <PopoverContent side="bottom" align="start" className="w-64 p-1">
            {canRewrite || ai.isPending ? (
              <AiRewriteMenuComponent isPending={ai.isPending} onRewrite={(instruction) => rewrite(target.pos, instruction)} />
            ) : (
              <p className="p-2 text-sm text-muted-foreground">Write something in this block first, then the AI can rework it.</p>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
