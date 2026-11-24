import { expect, it } from 'vitest';
import { keepRowInTable } from './keep-row-in-table';

const clampY = (y: number) =>
  keepRowInTable({
    transform: { x: 30, y, scaleX: 1, scaleY: 1 },
    draggingNodeRect: { top: 100, bottom: 146 },
    containerNodeRect: { top: 54, bottom: 192 },
  } as Parameters<typeof keepRowInTable>[0]);

it('keeps a dragged row inside the table and on its vertical axis', () => {
  expect(clampY(20)).toMatchObject({ x: 0, y: 20 });
  expect(clampY(500)).toMatchObject({ x: 0, y: 46 });
  expect(clampY(-500)).toMatchObject({ x: 0, y: -46 });
});
