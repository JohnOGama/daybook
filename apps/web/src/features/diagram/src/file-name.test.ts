import { expect, it } from 'vitest';
import { fileName } from './file-name';

it('names a download after the space', () => {
  expect(fileName('Shop database', 'sql')).toBe('shop-database.sql');
  expect(fileName('  Café & Bar!! ', 'png')).toBe('cafe-bar.png');
  expect(fileName('   ', 'sql')).toBe('diagram.sql');
});
