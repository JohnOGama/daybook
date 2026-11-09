import type { Space } from './space-types';

export type SpaceNode = Space & { children: Space[] };

export function buildSpaceTree(spaces: Space[]): SpaceNode[] {
  return spaces
    .filter((space) => space.parentId === null)
    .map((space) => ({
      ...space,
      children: spaces.filter((child) => child.parentId === space.id),
    }));
}

export const spaceHref = ({ id, tool }: Pick<Space, 'id' | 'tool'>) =>
  `${tool === 'notebook' ? '/notebook' : '/list'}?space=${id}`;

export function resolveActiveSpace(spaces: Space[], id: string | null): Space | undefined {
  const requested = spaces.find((space) => space.id === id && space.kind === 'space');
  if (requested) return requested;
  return buildSpaceTree(spaces)
    .flatMap((node) => (node.kind === 'folder' ? node.children : [node]))
    .at(0);
}
