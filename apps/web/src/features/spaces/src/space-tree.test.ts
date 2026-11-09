import { expect, it } from 'vitest';
import { buildSpaceTree, resolveActiveSpace } from './space-tree';
import type { Space } from './space-types';

function space(id: string, fields: Partial<Space> = {}): Space {
  return { id, parentId: null, kind: 'space', title: id, tool: 'list', createdAt: '', openToday: 0, ...fields };
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
