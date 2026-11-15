'use client';

import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useActiveSpace } from '@/features/spaces';
import { improveText } from '../src/pages-api';

// Sends one stretch of text to the AI and puts the reply in its place, unless that text changed meanwhile.
export function useAiRewrite(editor: Editor) {
  const space = useActiveSpace();
  const [isPending, setPending] = useState(false);

  async function rewrite(range: { from: number; to: number }, instruction: string) {
    const read = () => {
      const { doc } = editor.state;
      return range.to <= doc.content.size ? doc.textBetween(range.from, range.to, ' ') : null;
    };
    const original = read();
    if (!original?.trim() || !space) return;
    setPending(true);
    try {
      const { text } = await improveText({ spaceId: space.id, text: original, instruction });
      if (read() !== original) {
        toast.error('That text changed before the AI finished, so it was left as it is.');
        return;
      }
      editor.commands.insertContentAt(range, { type: 'text', text });
      toast.success('Text rewritten', { action: { label: 'Undo', onClick: () => editor.commands.undo() } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The AI couldn't help with that just now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return { rewrite, isPending };
}
