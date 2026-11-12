import type { JSONContent } from '@tiptap/react';

const WORDS_PER_MINUTE = 250;

function plainText(node: JSONContent): string {
  if (node.type === 'hardBreak') return ' ';
  if (node.text !== undefined) return node.text;
  const children = node.content ?? [];
  const holdsText = children.some((child) => child.text !== undefined);
  return children.map(plainText).join(holdsText ? '' : ' ');
}

export const wordCount = (content: JSONContent | null) =>
  content ? plainText(content).split(/\s+/).filter(Boolean).length : 0;

export const formatWords = (words: number) => `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`;

export const readingTime = (words: number) => `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`;

export const chapterTitle = ({ title }: { title: string }) => title.trim() || 'Untitled chapter';
