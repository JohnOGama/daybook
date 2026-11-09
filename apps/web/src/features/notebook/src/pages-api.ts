import type { NotebookPage, PageChanges } from './page-types';

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

export async function deletePage(id: string): Promise<void> {
  const response = await fetch(`/api/notebook-pages/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('That page could not be deleted. Please try again.');
}
