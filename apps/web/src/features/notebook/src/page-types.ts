import type { JSONContent } from '@tiptap/react';

export type NotebookPage = {
  id: string;
  title: string;
  content: JSONContent | null;
  createdAt: string;
  version: number;
};

export type PageVersion = { id: string; createdAt: string };

export type PageChanges = Partial<Pick<NotebookPage, 'title'>> & { content?: JSONContent };

export const pageTitle = ({ title }: Pick<NotebookPage, 'title'>) => title.trim() || 'Untitled';

const textOf = (node: JSONContent): string => node.text ?? (node.content ?? []).map(textOf).join(' ');

export const pageSnippet = (content: JSONContent | null) =>
  content ? textOf(content).replace(/\s+/g, ' ').trim().slice(0, 80) : '';
