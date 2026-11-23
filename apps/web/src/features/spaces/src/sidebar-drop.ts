import { arrayMove } from '@dnd-kit/sortable';

export const GROUP_LIST = 'group-';

// A dragged row or what it was dropped on: its id, the sortable list it sits in (a group list, or a folder's id for a
// folder's spaces), and, for drop zones, the group heading or folder it stands for.
export type DropSide = { id: string; list?: string; groupId?: string; folderId?: string; items?: string[] };

export type DropAction =
  | { kind: 'folder'; id: string; parentId: string }
  | { kind: 'group'; id: string; groupId: string; order: string[] }
  | { kind: 'reorder'; order: string[] };

// What dropping a sidebar row does, the same moves as the Move to menu. `topLevelIn` lists a group's top-level ids.
export function dropAction(active: DropSide, over: DropSide, topLevelIn: (groupId: string) => string[]): DropAction | undefined {
  if (active.id === over.id) return undefined;
  if (over.folderId) return over.folderId === active.list ? undefined : { kind: 'folder', id: active.id, parentId: over.folderId };

  // Into another group, or out of a folder into a group: at the row it was dropped on, or last when dropped on the heading.
  const groupId = over.groupId ?? (over.list?.startsWith(GROUP_LIST) ? over.list.slice(GROUP_LIST.length) : undefined);
  if (groupId && active.list !== GROUP_LIST + groupId) {
    const ids = topLevelIn(groupId).filter((id) => id !== active.id);
    const at = over.groupId ? ids.length : ids.indexOf(over.id);
    return { kind: 'group', id: active.id, groupId, order: [...ids.slice(0, at), active.id, ...ids.slice(at)] };
  }
  if (over.groupId) return undefined;

  // Onto a space inside another folder: into that folder.
  if (over.list && over.list !== active.list) return { kind: 'folder', id: active.id, parentId: over.list };

  const items = active.items ?? [];
  return { kind: 'reorder', order: arrayMove(items, items.indexOf(active.id), items.indexOf(over.id)) };
}
