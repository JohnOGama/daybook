import { expect, it } from 'vitest';
import { addSpace, applySpaceOrder, buildSpace, duplicateOf, removeSpace, renameSpace, withCarryOver } from './space-cache';
import type { Space } from './space-types';

function space(id: string, fields: Partial<Space> = {}): Space {
  return { id, parentId: null, kind: 'space', title: id, tool: 'list', carryOver: true, locked: false, createdAt: '', openToday: 0, ...fields };
}

it('changes carry over on only the matching space', () => {
  expect(withCarryOver([space('a'), space('b')], 'a', false).map((s) => s.carryOver)).toEqual([false, true]);
});

it('adds a space at the end', () => {
  expect(addSpace([space('a')], space('b')).map((s) => s.id)).toEqual(['a', 'b']);
});

it('builds a space from the form input', () => {
  expect(buildSpace({ id: 'n', kind: 'space', title: ' Home ', tool: 'list', parentId: 'f' })).toMatchObject({
    id: 'n',
    title: 'Home',
    tool: 'list',
    parentId: 'f',
    openToday: 0,
  });
});

it('builds a folder with no tool', () => {
  expect(buildSpace({ id: 'n', kind: 'folder', title: 'Team' })).toMatchObject({ kind: 'folder', tool: null, parentId: null });
});

it('puts the given spaces in order and leaves the rest in theirs', () => {
  const spaces = [space('a'), space('b'), space('c'), space('d')];
  expect(applySpaceOrder(spaces, ['c', 'a']).map((s) => s.id)).toEqual(['c', 'a', 'b', 'd']);
});

it('renames only the matching space', () => {
  expect(renameSpace([space('a'), space('b')], 'a', 'New').map((s) => s.title)).toEqual(['New', 'b']);
});

it('removing a folder removes the spaces inside it', () => {
  const list = [space('f', { kind: 'folder', tool: null }), space('in', { parentId: 'f' }), space('out')];
  expect(removeSpace(list, 'f').map((s) => s.id)).toEqual(['out']);
});

it('removing a space leaves its siblings', () => {
  const list = [space('in', { parentId: 'f' }), space('other', { parentId: 'f' })];
  expect(removeSpace(list, 'in').map((s) => s.id)).toEqual(['other']);
});

it('a duplicate keeps the folder and count, with a marked title and new id', () => {
  expect(duplicateOf(space('a', { title: 'Home', parentId: 'f', openToday: 3 }), 'b')).toMatchObject({
    id: 'b',
    title: 'Home (copy)',
    parentId: 'f',
    openToday: 3,
  });
});

it('a duplicate title stays within 200 characters', () => {
  expect(duplicateOf(space('a', { title: 'a'.repeat(200) }), 'b').title).toHaveLength(200);
});
