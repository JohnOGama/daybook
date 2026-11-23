import { expect, it } from 'vitest';
import { dropAction } from './sidebar-drop';

const groups: Record<string, string[]> = { work: ['a', 'folder-1', 'b'], home: ['c', 'd'] };
const topLevelIn = (groupId: string) => groups[groupId];
const inWork = (id: string) => ({ id, list: 'group-work', items: groups.work });
const inFolder = (id: string) => ({ id, list: 'folder-1', items: ['x', 'y'] });

it('reorders within the same list', () => {
  expect(dropAction(inWork('a'), inWork('b'), topLevelIn)).toEqual({ kind: 'reorder', order: ['folder-1', 'b', 'a'] });
  expect(dropAction(inFolder('x'), inFolder('y'), topLevelIn)).toEqual({ kind: 'reorder', order: ['y', 'x'] });
});

it('puts a space into a folder dropped on its header, but not its own folder', () => {
  expect(dropAction(inWork('a'), { id: 'folder-drop:folder-2', folderId: 'folder-2' }, topLevelIn)).toEqual({ kind: 'folder', id: 'a', parentId: 'folder-2' });
  expect(dropAction(inFolder('x'), { id: 'folder-drop:folder-1', folderId: 'folder-1' }, topLevelIn)).toBeUndefined();
});

it('moves a space between folders when dropped on a space in the other folder', () => {
  expect(dropAction(inFolder('x'), { id: 'z', list: 'folder-2' }, topLevelIn)).toEqual({ kind: 'folder', id: 'x', parentId: 'folder-2' });
});

it('moves a row to another group at the row it lands on, or last on the heading', () => {
  expect(dropAction(inWork('a'), { id: 'd', list: 'group-home' }, topLevelIn)).toEqual({ kind: 'group', id: 'a', groupId: 'home', order: ['c', 'a', 'd'] });
  expect(dropAction(inWork('a'), { id: 'group-drop:home', groupId: 'home' }, topLevelIn)).toEqual({ kind: 'group', id: 'a', groupId: 'home', order: ['c', 'd', 'a'] });
});

it('takes a space out of its folder into its own group too', () => {
  expect(dropAction(inFolder('x'), inWork('b'), topLevelIn)).toEqual({ kind: 'group', id: 'x', groupId: 'work', order: ['a', 'folder-1', 'x', 'b'] });
  expect(dropAction(inFolder('x'), { id: 'group-drop:work', groupId: 'work' }, topLevelIn)).toEqual({ kind: 'group', id: 'x', groupId: 'work', order: ['a', 'folder-1', 'b', 'x'] });
});

it('does nothing on its own group heading or on itself', () => {
  expect(dropAction(inWork('a'), { id: 'group-drop:work', groupId: 'work' }, topLevelIn)).toBeUndefined();
  expect(dropAction(inWork('a'), inWork('a'), topLevelIn)).toBeUndefined();
});
