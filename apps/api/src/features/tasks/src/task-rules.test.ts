import { expect, it } from 'vitest';
import { appearsOn } from './task-rules.ts';

const today = '2026-11-09';

it('finished task stays on its finished day', () => {
  expect(appearsOn({ plannedDay: '2026-11-20', completedOn: '2026-11-06' }, today)).toBe('2026-11-06');
});

it('open task on a future day stays there', () => {
  expect(appearsOn({ plannedDay: '2026-11-20', completedOn: null }, today)).toBe('2026-11-20');
});

it('open task from a past day moves to today', () => {
  expect(appearsOn({ plannedDay: '2026-11-06', completedOn: null }, today)).toBe(today);
});
