import { copyTitle } from '@/shared/utils/copy-title';
import type { NewSpaceInput, Space, SpaceGroup } from './space-types';

export const addSpace = (spaces: Space[], space: Space): Space[] => [...spaces, space];

export function buildSpace(input: NewSpaceInput): Space {
  return {
    id: input.id,
    parentId: input.kind === 'space' ? (input.parentId ?? null) : null,
    groupId: input.kind === 'space' && input.parentId ? null : (input.groupId ?? null),
    kind: input.kind,
    title: input.title.trim(),
    tool: input.kind === 'space' ? input.tool : null,
    carryOver: true,
    locked: false,
    createdAt: new Date().toISOString(),
    openToday: 0,
    access: 'owner',
    shared: false,
    ownerId: '',
    ownerName: null,
    pipelines: null,
  };
}

export const renameSpace = (spaces: Space[], id: string, title: string): Space[] =>
  spaces.map((space) => (space.id === id ? { ...space, title } : space));

export const withCarryOver = (spaces: Space[], id: string, carryOver: boolean): Space[] =>
  spaces.map((space) => (space.id === id ? { ...space, carryOver } : space));

// Mirrors the server: the moved space becomes the last one in its new folder; out of a folder, it joins the folder's group.
export function moveSpace(spaces: Space[], id: string, parentId: string | null): Space[] {
  const moved = spaces.find((space) => space.id === id);
  if (!moved) return spaces;
  const folder = spaces.find((space) => space.id === moved.parentId);
  const groupId = parentId ? null : (folder?.groupId ?? moved.groupId ?? null);
  return [...spaces.filter((space) => space.id !== id), { ...moved, parentId, groupId }];
}

// Mirrors the server: the item leaves any folder and goes last in the group, or where `order` puts it.
export function moveToGroup(spaces: Space[], id: string, groupId: string, order?: string[]): Space[] {
  const moved = spaces.find((space) => space.id === id);
  if (!moved) return spaces;
  const next = [...spaces.filter((space) => space.id !== id), { ...moved, groupId, parentId: null }];
  return order ? applySpaceOrder(next, order) : next;
}

// The group a top-level item shows under: its own, or the first group when it has none yet (or that one is gone).
export function groupOf(space: Space, groups: SpaceGroup[]): string | undefined {
  return groups.some((group) => group.id === space.groupId) ? (space.groupId as string) : groups[0]?.id;
}

// Mirrors deleting a group: its top-level items go (and the spaces inside its folders with them).
export function removeGroupItems(spaces: Space[], groupId: string, groups: SpaceGroup[]): Space[] {
  const gone = new Set(spaces.filter((space) => space.parentId === null && space.access === 'owner' && groupOf(space, groups) === groupId).map((space) => space.id));
  return spaces.filter((space) => !gone.has(space.id) && !(space.parentId && gone.has(space.parentId)));
}

export function applySpaceOrder(spaces: Space[], ids: string[]): Space[] {
  const rank = (space: Space) => {
    const index = ids.indexOf(space.id);
    return index === -1 ? ids.length : index;
  };
  return [...spaces].sort((a, b) => rank(a) - rank(b));
}

export const removeSpace =(spaces: Space[], id: string): Space[] =>
  spaces.filter((space) => space.id !== id && space.parentId !== id);

export const duplicateOf = (space: Space, id: string): Space => ({
  ...space,
  id,
  title: copyTitle(space.title),
  shared: false,
  createdAt: new Date().toISOString(),
});
