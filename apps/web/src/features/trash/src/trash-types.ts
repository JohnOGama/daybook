export type TrashItem = {
  id: string;
  type: 'task' | 'subtask' | 'space' | 'folder';
  title: string;
  location: string | null;
  deletedAt: string;
};
