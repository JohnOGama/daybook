import { copyTitle } from '@/shared/utils/copy-title';
import type { NewSpaceInput, Space } from './space-types';

export const addSpace = (spaces: Space[], space: Space): Space[] => [...spaces, space];

export function buildSpace(input: NewSpaceInput): Space {
  return {
    id: input.id,
    parentId: input.kind === 'space' ? (input.parentId ?? null) : null,
    kind: input.kind,
    title: input.title.trim(),
    tool: input.kind === 'space' ? input.tool : null,
    carryOver: true,
    locked: false,
    createdAt: new Date().toISOString(),
    openToday: 0,
  };
}

export const renameSpace = (spaces: Space[], id: string, title: string): Space[] =>
  spaces.map((space) => (space.id === id ? { ...space, title } : space));

export const withCarryOver = (spaces: Space[], id: string, carryOver: boolean): Space[] =>
  spaces.map((space) => (space.id === id ? { ...space, carryOver } : space));

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
  createdAt: new Date().toISOString(),
});
