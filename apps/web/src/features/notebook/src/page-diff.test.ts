import { expect, it } from 'vitest';
import { diffLines, pageLines } from './page-diff';

const text = (value: string) => ({ type: 'text', text: value });
const paragraph = (...values: string[]) => ({ type: 'paragraph', content: values.map(text) });

it('reads one line per paragraph and list item, joining marked-up text and skipping empty blocks', () => {
  const doc = {
    type: 'doc',
    content: [
      paragraph('Hello ', 'world'),
      { type: 'paragraph' },
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Milk')] }, { type: 'listItem', content: [paragraph('Eggs')] }] },
    ],
  };
  expect(pageLines(doc)).toEqual(['Hello world', 'Milk', 'Eggs']);
  expect(pageLines(null)).toEqual([]);
});

it('marks what was removed and added between two versions and keeps the rest in order', () => {
  expect(diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toEqual([
    { kind: 'same', text: 'a' },
    { kind: 'removed', text: 'b' },
    { kind: 'added', text: 'x' },
    { kind: 'same', text: 'c' },
    { kind: 'added', text: 'd' },
  ]);
  expect(diffLines([], ['a'])).toEqual([{ kind: 'added', text: 'a' }]);
});
