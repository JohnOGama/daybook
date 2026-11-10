import type { TrashItem } from './trash-types';

export async function fetchTrash(): Promise<TrashItem[]> {
  const response = await fetch('/api/trash');
  if (!response.ok) throw new Error('Could not load the trash');
  return response.json();
}

const COLLECTIONS: Record<TrashItem['type'], string> = {
  task: 'tasks',
  subtask: 'tasks',
  space: 'spaces',
  folder: 'spaces',
  page: 'pages',
  'vault-item': 'vault-items',
};

export async function restoreItem(item: TrashItem): Promise<void> {
  const response = await fetch(`/api/trash/${COLLECTIONS[item.type]}/${item.id}/restore`, { method: 'POST' });
  if (!response.ok) throw new Error(`"${item.title}" could not be restored. Please try again.`);
}
