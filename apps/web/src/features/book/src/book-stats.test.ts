import { expect, it } from 'vitest';
import { chapterTitle, formatWords, readingTime, wordCount } from './book-stats';

const paragraph = (...content: object[]) => ({ type: 'paragraph', content });
const text = (value: string, bold = false) => ({ type: 'text', text: value, ...(bold ? { marks: [{ type: 'bold' }] } : {}) });

it('counts a word split by formatting once, and words in separate blocks apart', () => {
  const doc = {
    type: 'doc',
    content: [
      paragraph(text('Hel'), text('lo', true), text(' world')),
      paragraph(text('line'), { type: 'hardBreak' }, text('break')),
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('one'))] }] },
    ],
  };
  expect(wordCount(doc)).toBe(5);
});

it('treats an empty chapter as no words', () => {
  expect(wordCount(null)).toBe(0);
  expect(wordCount({ type: 'doc', content: [paragraph()] })).toBe(0);
});

it('labels counts, reading time and untitled chapters', () => {
  expect(formatWords(1)).toBe('1 word');
  expect(formatWords(1200)).toBe('1,200 words');
  expect(readingTime(40)).toBe('1 min read');
  expect(readingTime(1000)).toBe('4 min read');
  expect(chapterTitle({ title: '  ' })).toBe('Untitled chapter');
});
