import { expect, it } from 'vitest';
import { dueLabel, dueTone } from './due-date';

const today = '2026-11-24';

it('colours a due date by how close it is, and never calls a finished task overdue', () => {
  expect(dueTone('2026-11-23', today, false)).toBe('overdue');
  expect(dueTone('2026-11-23', today, true)).toBe('later');
  expect(dueTone(today, today, false)).toBe('today');
  expect(dueTone('2026-12-01', today, false)).toBe('soon');
  expect(dueTone('2026-12-02', today, false)).toBe('later');
});

it('says today, tomorrow and yesterday in words, other days as a short date', () => {
  expect(dueLabel(today, today)).toBe('Today');
  expect(dueLabel('2026-11-25', today)).toBe('Tomorrow');
  expect(dueLabel('2026-11-23', today)).toBe('Yesterday');
  expect(dueLabel('2026-12-05', today)).toMatch(/5 Dec/);
});
