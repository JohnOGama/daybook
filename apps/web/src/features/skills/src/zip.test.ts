import { expect, it } from 'vitest';
import { crc32, zipFiles } from './zip';

const encode = (text: string) => new TextEncoder().encode(text);
const view = (bytes: Uint8Array) => new DataView(bytes.buffer);

it('computes the standard CRC-32', () => {
  expect(crc32(encode('hello'))).toBe(0x3610a686);
  expect(crc32(encode(''))).toBe(0);
});

it('stores each file after a local header and lists them all in the central directory', () => {
  const zip = zipFiles([
    { path: 'skill/SKILL.md', text: '# Hi' },
    { path: 'skill/templates/é.txt', text: 'café' },
  ]);
  const bytes = view(zip);
  expect(bytes.getUint32(0, true)).toBe(0x04034b50);
  expect(bytes.getUint32(14, true)).toBe(crc32(encode('# Hi')));
  expect(new TextDecoder().decode(zip.slice(30, 30 + 14))).toBe('skill/SKILL.md');
  expect(new TextDecoder().decode(zip.slice(44, 48))).toBe('# Hi');

  const end = zip.length - 22;
  expect(bytes.getUint32(end, true)).toBe(0x06054b50);
  expect(bytes.getUint16(end + 10, true)).toBe(2);
  const directoryAt = bytes.getUint32(end + 16, true);
  expect(bytes.getUint32(directoryAt, true)).toBe(0x02014b50);
  expect(directoryAt + bytes.getUint32(end + 12, true)).toBe(end);
});
