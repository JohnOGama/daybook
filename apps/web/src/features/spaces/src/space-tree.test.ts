import { expect, it } from 'vitest';
import { buildSpaceTree, isOnWrongScreen, resolveActiveSpace, spaceHref } from './space-tree';
import type { Space, SpaceTool } from './space-types';

function space(id: string, fields: Partial<Space> = {}): Space {
  return { id, parentId: null, kind: 'space', title: id, tool: 'list', carryOver: true, createdAt: '', openToday: 0, ...fields };
}

const folder = space('team', { kind: 'folder', tool: null });
const inside = space('requests', { parentId: 'team' });
const top = space('home');

it('nests spaces under their folder and keeps the order', () => {
  const tree = buildSpaceTree([folder, inside, top]);
  expect(tree.map((node) => node.id)).toEqual(['team', 'home']);
  expect(tree[0].children.map((child) => child.id)).toEqual(['requests']);
  expect(tree[1].children).toEqual([]);
});

it('uses the requested space', () => {
  expect(resolveActiveSpace([folder, inside, top], 'home')?.id).toBe('home');
});

it('falls back to the first space in sidebar order', () => {
  expect(resolveActiveSpace([folder, inside, top], null)?.id).toBe('requests');
});

it('ignores an unknown id', () => {
  expect(resolveActiveSpace([top], 'gone')?.id).toBe('home');
});

it('never treats a folder as the active space', () => {
  expect(resolveActiveSpace([folder, inside], 'team')?.id).toBe('requests');
});

it('has no active space when only folders exist', () => {
  expect(resolveActiveSpace([folder], null)).toBeUndefined();
});

it('links a vault to its screen', () => {
  expect(spaceHref({ id: 'a', tool: 'vault' })).toBe('/vault?space=a');
});

it.each([
  ['vault', '/vault', false],
  ['vault', '/list', true],
  ['notebook', '/vault', true],
  ['list', '/vault', true],
  ['list', '/kanban', false],
  ['list', '/settings', false],
  ['notebook', '/notebook', false],
])('%s on %s: wrong screen %s', (tool, path, wrong) => {
  expect(isOnWrongScreen(tool as SpaceTool, path)).toBe(wrong);
});
