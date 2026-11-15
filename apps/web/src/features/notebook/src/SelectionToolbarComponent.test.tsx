import { Editor } from '@tiptap/react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1', tool: 'notebook' }) }));
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

it('offers AI on the highlighted text only where it is turned on, and puts the reply in its place', async () => {
  expect(screen.queryByRole('button', { name: 'Improve with AI' })).not.toBeInTheDocument();
  const send = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ text: 'Hi there' })));
  vi.stubGlobal('fetch', send);
  const panel = within(render(<SelectionPanel editor={editor} improveWithAi />).container);
  await userEvent.click(panel.getByRole('button', { name: 'Improve with AI' }));
  await userEvent.click(panel.getByRole('button', { name: 'Improve writing' }));
  await waitFor(() => expect(editor.getHTML()).toBe('<p>Hi there</p>'));
  expect(send.mock.calls[0][0]).toBe('/api/notebook-pages/ai/improve');
  expect(String(send.mock.calls[0][1].body)).toContain('Hello world');
  expect(JSON.parse(String(send.mock.calls[0][1].body)).spaceId).toBe('s1');
  vi.unstubAllGlobals();
});
