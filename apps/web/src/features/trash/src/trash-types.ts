export type TrashItem = {
  id: string;
  type: 'task' | 'subtask' | 'space' | 'folder' | 'page' | 'vault-item';
  title: string;
  location: string | null;
  deletedAt: string;
  payload?: { iv: string; ciphertext: string };
};
