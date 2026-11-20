import { expect, it } from 'vitest';
import { addSpace, applySpaceOrder, buildSpace, duplicateOf, groupOf, moveSpace, moveToGroup, removeGroupItems, removeSpace, renameSpace, withCarryOver } from './space-cache';
import type { Space } from './space-types';

function space(id: string, fields: Partial<Space> = {}): Space {
  return { id, parentId: null, kind: 'space', title: id, tool: 'list', carryOver: true, locked: false, createdAt: '', openToday: 0, access: 'owner', shared: false, ownerId: 'me', ownerName: null, ...fields };
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

it('a duplicate keeps the folder and count, with a marked title and new id, and is not shared', () => {
  expect(duplicateOf(space('a', { title: 'Home', parentId: 'f', openToday: 3, shared: true }), 'b')).toMatchObject({
    id: 'b',
    title: 'Home (copy)',
    parentId: 'f',
    openToday: 3,
    shared: false,
  });
});

it('a duplicate title stays within 200 characters', () => {
  expect(duplicateOf(space('a', { title: 'a'.repeat(200) }), 'b').title).toHaveLength(200);
});

const groups = [
  { id: 'g1', title: 'Spaces' },
  { id: 'g2', title: 'Work' },
];

it('shows a top-level item in its own group, or the first group when it has none or that one is gone', () => {
  expect(groupOf(space('a', { groupId: 'g2' }), groups)).toBe('g2');
  expect(groupOf(space('a', { groupId: null }), groups)).toBe('g1');
  expect(groupOf(space('a', { groupId: 'gone' }), groups)).toBe('g1');
});

it('deleting a group drops its top-level items and the spaces in its folders, and keeps the rest', () => {
  const list = [
    space('home', { groupId: 'g1' }),
    space('folder', { kind: 'folder', tool: null, groupId: 'g2' }),
    space('inside', { parentId: 'folder' }),
    space('client', { groupId: 'g2' }),
    space('shared', { groupId: null, access: 'view' }),
  ];
  expect(removeGroupItems(list, 'g2', groups).map((s) => s.id)).toEqual(['home', 'shared']);
});

it("a space taken out of a folder joins the folder's group, like the server", () => {
  const list = [space('folder', { kind: 'folder', tool: null, groupId: 'g2' }), space('inside', { parentId: 'folder', groupId: null })];
  expect(moveSpace(list, 'inside', null).find((s) => s.id === 'inside')).toMatchObject({ parentId: null, groupId: 'g2' });
});

it('moving to a group takes a space out of its folder and puts it where the drop was', () => {
  const list = [space('a', { groupId: 'g2' }), space('inside', { parentId: 'folder' }), space('b', { groupId: 'g2' })];
  const moved = moveToGroup(list, 'inside', 'g2', ['a', 'inside', 'b']);
  expect(moved.map((s) => s.id)).toEqual(['a', 'inside', 'b']);
  expect(moved[1]).toMatchObject({ parentId: null, groupId: 'g2' });
});
