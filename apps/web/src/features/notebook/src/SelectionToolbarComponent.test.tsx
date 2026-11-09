import { Editor } from '@tiptap/react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { EDITOR_EXTENSIONS } from './editor-extensions';
import { SelectionPanel } from './SelectionToolbarComponent';

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
    content: '<p>Hello world</p>',
    element: document.body.appendChild(document.createElement('div')),
  });
  editor.commands.setTextSelection({ from: 1, to: 12 });
  render(<SelectionPanel editor={editor} />);
});

afterEach(() => editor.destroy());

const click = (name: string) => userEvent.click(screen.getByRole('button', { name }));

it('bolds the selection and shows it as on', async () => {
  await click('Bold');
  expect(editor.getHTML()).toContain('<strong>Hello world</strong>');
  expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
});

it('clears formatting', async () => {
  await click('Italic');
  await click('Clear formatting');
  expect(editor.getHTML()).toBe('<p>Hello world</p>');
});

it.each([
  ['Heading 2', '<h2>'],
  ['Bulleted list', '<ul>'],
  ['To-do list', 'data-type="taskList"'],
])('turns the block into %s', async (label, html) => {
  await click('Text');
  await click(label);
  expect(editor.getHTML()).toContain(html);
  expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
});

it('adds https to a link typed without it', async () => {
  await click('Link');
  await userEvent.type(screen.getByRole('textbox', { name: 'Link address' }), 'example.com{Enter}');
  expect(editor.getAttributes('link').href).toBe('https://example.com');
});

it('refuses a script link', async () => {
  await click('Link');
  await userEvent.type(screen.getByRole('textbox', { name: 'Link address' }), 'javascript:alert(1){Enter}');
  expect(editor.getHTML()).not.toContain('javascript:');
});

it('goes back to the buttons when the selection moves', async () => {
  await click('Link');
  act(() => {
    editor.commands.setTextSelection({ from: 2, to: 4 });
  });
  expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
});
