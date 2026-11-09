import { Editor, type JSONContent } from '@tiptap/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { parseTaskList } from '@/features/tasks/src/parse-task-list';
import { EDITOR_EXTENSIONS } from './editor-extensions';

const sample = `- [ ]  site admin pref → Default order
- [ ]  Remove SYNCQ
- [ ]  If Site SSO
    - [ ]  Enable SSO config in payload
- [ ]  If has auto approval feature
    - [ ]  Set the correct email
    - [ ]  Check the config with previous store
- [ ]  Enable reCAPTCHA`;

let editor: Editor;

beforeAll(() => {
  const noRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  Range.prototype.getClientRects = noRects;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Element.prototype.getClientRects = noRects;
  document.elementFromPoint = vi.fn(() => null);
});

beforeEach(() => {
  editor = new Editor({
    extensions: EDITOR_EXTENSIONS,
    element: document.body.appendChild(document.createElement('div')),
  });
});

afterEach(() => editor.destroy());

function paste(text: string, html = '') {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const getData = (type: string) => ({ 'text/plain': text, 'text/html': html })[type] ?? '';
  Object.defineProperty(event, 'clipboardData', { value: { getData, files: [], items: [], types: ['text/plain'] } });
  editor.view.dom.dispatchEvent(event);
}

const textOf = (node: JSONContent): string => node.text ?? (node.content ?? []).map(textOf).join('');

function outline(nodes: JSONContent[] = editor.getJSON().content ?? [], depth = 0): string[] {
  return nodes.flatMap((node) => {
    if (!node.type?.endsWith('List')) return [`${'  '.repeat(depth)}${node.type}: ${textOf(node)}`];
    return (node.content ?? []).flatMap((item) => {
      const [first, ...rest] = item.content ?? [];
      return [`${'  '.repeat(depth)}${item.type}: ${textOf(first)}`, ...outline(rest, depth + 1)];
    });
  });
}

it('a pasted checklist becomes a to-do list that keeps its indentation', () => {
  paste(sample);
  expect(outline()).toEqual([
    'taskItem: site admin pref → Default order',
    'taskItem: Remove SYNCQ',
    'taskItem: If Site SSO',
    '  taskItem: Enable SSO config in payload',
    'taskItem: If has auto approval feature',
    '  taskItem: Set the correct email',
    '  taskItem: Check the config with previous store',
    'taskItem: Enable reCAPTCHA',
    'paragraph: ',
  ]);
});

it('keeps checked items ticked', () => {
  paste('- [x] Done\n- [ ] Open');
  const [list]: JSONContent[] = editor.getJSON().content ?? [];
  expect(list.content?.map((item) => item.attrs?.checked)).toEqual([true, false]);
});

it('handles bullets, numbers and three levels of nesting', () => {
  paste('1. One\n    - Under one\n        - [ ] Deeper\n2. Two\nA plain line');
  expect(outline()).toEqual([
    'listItem: One',
    '  listItem: Under one',
    '    taskItem: Deeper',
    'listItem: Two',
    'paragraph: A plain line',
  ]);
});

it('leaves ordinary multi-line text alone', () => {
  paste('First line\nSecond line');
  expect(outline().join()).not.toContain('Item');
});

it('does not convert a single marked line', () => {
  paste('- just this');
  expect(outline()).toEqual(['paragraph: - just this']);
});

it('leaves a list pasted into a code block as text', () => {
  editor.commands.setCodeBlock();
  paste(sample);
  expect(editor.getJSON().content?.[0].type).toBe('codeBlock');
  expect(textOf(editor.getJSON())).toContain('    - [ ]  Enable SSO config in payload');
});

it('keeps formatting when a list is copied between pages', () => {
  paste('<ignored>\n- rich', '<ul data-pm-slice="1 1 []"><li><strong>rich</strong></li></ul>');
  expect(JSON.stringify(editor.getJSON())).toContain('"bold"');
});

it('the bulk task paste reads the same text correctly', () => {
  expect(parseTaskList(sample).map((task) => task.subtasks.length)).toEqual([0, 0, 1, 2, 0]);
});

it('copying a list out of a page keeps its indentation for the bulk task paste', () => {
  paste(sample);
  editor.commands.selectAll();
  const { from, to } = editor.state.selection;
  const { text } = editor.view.serializeForClipboard(editor.state.doc.slice(from, to));
  expect(parseTaskList(text).map((task) => task.subtasks.length)).toEqual([0, 0, 1, 2, 0]);
});
