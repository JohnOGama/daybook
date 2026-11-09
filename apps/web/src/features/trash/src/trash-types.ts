export type TrashItem = {
  id: string;
  type: 'task' | 'subtask' | 'space' | 'folder' | 'page';
  title: string;
  location: string | null;
  deletedAt: string;
};
