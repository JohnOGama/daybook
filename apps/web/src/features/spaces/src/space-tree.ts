import type { Space, SpaceTool } from './space-types';

const TOOL_SCREENS: Partial<Record<SpaceTool, string>> = { notebook: '/notebook', vault: '/vault' };

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
  `${(tool && TOOL_SCREENS[tool]) || '/list'}?space=${id}`;

export function isOnWrongScreen(tool: SpaceTool | null, pathname: string): boolean {
  const ownScreen = tool ? TOOL_SCREENS[tool] : undefined;
  return ownScreen ? pathname !== ownScreen : Object.values(TOOL_SCREENS).includes(pathname);
}

export function resolveActiveSpace(spaces: Space[], id: string | null): Space | undefined {
  const requested = spaces.find((space) => space.id === id && space.kind === 'space');
  if (requested) return requested;
  return buildSpaceTree(spaces)
    .flatMap((node) => (node.kind === 'folder' ? node.children : [node]))
    .at(0);
}
