import type { JSONContent } from '@tiptap/react';
import type { NotebookPage, PageChanges, PageVersion } from './page-types';

const KEEPALIVE_BODY_LIMIT = 60_000;

export async function fetchPages(spaceId: string): Promise<NotebookPage[]> {
  const response = await fetch(`/api/notebook-pages?${new URLSearchParams({ spaceId })}`);
  if (!response.ok) throw new Error('Could not load this notebook');
  return response.json();
}

export async function createPage({ id, spaceId }: { id: string; spaceId: string }): Promise<void> {
  const response = await fetch('/api/notebook-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, spaceId }),
  });
  if (!response.ok) throw new Error('That page could not be added. Please try again.');
}

export async function updatePage({ id, changes }: { id: string; changes: PageChanges }): Promise<void> {
  const body = JSON.stringify(changes);
  const response = await fetch(`/api/notebook-pages/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: body.length < KEEPALIVE_BODY_LIMIT,
  });
  if (!response.ok) throw new Error('Your latest changes could not be saved.');
}

export async function reorderPages({ spaceId, ids }: { spaceId: string; ids: string[] }): Promise<void> {
  const response = await fetch('/api/notebook-pages/order', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spaceId, ids }),
  });
  if (!response.ok) throw new Error('That order could not be saved. Please try again.');
}

export async function deletePage(id: string): Promise<void> {
  const response = await fetch(`/api/notebook-pages/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('That page could not be deleted. Please try again.');
}

export async function improveText(input: { text: string; instruction: string }): Promise<{ text: string }> {
  const response = await fetch('/api/notebook-pages/ai/improve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 503) throw new Error('AI features are off on this server.');
  if (response.status === 429) throw new Error('The AI service is busy. Please try again in a minute.');
  if (!response.ok) throw new Error("The AI couldn't help with that just now. Please try again.");
  return response.json();
}

export async function fetchVersions(pageId: string): Promise<PageVersion[]> {
  const response = await fetch(`/api/notebook-pages/${pageId}/versions`);
  if (!response.ok) throw new Error('Could not load the history');
  return response.json();
}

export async function fetchVersion(pageId: string, versionId: string): Promise<PageVersion & { content: JSONContent }> {
  const response = await fetch(`/api/notebook-pages/${pageId}/versions/${versionId}`);
  if (!response.ok) throw new Error('Could not load this version');
  return response.json();
}

export async function checkpointPage(pageId: string): Promise<void> {
  const response = await fetch(`/api/notebook-pages/${pageId}/versions`, { method: 'POST' });
  if (!response.ok) throw new Error('That version could not be restored. Please try again.');
}
