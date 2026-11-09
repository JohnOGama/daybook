import type { TrashItem } from './trash-types';

export async function fetchTrash(): Promise<TrashItem[]> {
  const response = await fetch('/api/trash');
  if (!response.ok) throw new Error('Could not load the trash');
  return response.json();
}

export async function restoreItem(item: TrashItem): Promise<void> {
  const collection = item.type === 'task' || item.type === 'subtask' ? 'tasks' : 'spaces';
  const response = await fetch(`/api/trash/${collection}/${item.id}/restore`, { method: 'POST' });
  if (!response.ok) throw new Error(`"${item.title}" could not be restored. Please try again.`);
}
