import { expect, it } from 'vitest';
import { readEnv } from './read-env.ts';

it('names every missing variable', () => {
  expect(() => readEnv(['NOPE_A', 'NOPE_B'])).toThrow(/NOPE_A.*NOPE_B/);
});
