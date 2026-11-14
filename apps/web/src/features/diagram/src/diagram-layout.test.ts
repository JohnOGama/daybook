import { describe, expect, it } from 'vitest';
import { placeTables, TABLE_WIDTH, tableHeight, tidyLayout } from './diagram-layout';
import type { DiagramModel, Positions, Table } from './diagram-types';

const table = (name: string, columns = 3): Table => ({
  name,
  columns: Array.from({ length: columns }, (_, index) => ({ name: `c${index}`, type: 'int', pk: false, unique: false, notNull: false })),
});

const model: DiagramModel = {
  tables: [table('users'), table('orders', 5), table('items', 2)],
  refs: [
    { from: { table: 'orders', column: 'c1' }, to: { table: 'users', column: 'c0' }, kind: 'manyToOne' },
    { from: { table: 'items', column: 'c0' }, to: { table: 'orders', column: 'c0' }, kind: 'manyToOne' },
  ],
};

const overlaps = (positions: Positions, a: string, b: string) => {
  const box = (name: string) => ({ ...positions[name], h: tableHeight(model.tables.find((t) => t.name === name) ?? table(name)) });
  const [p, q] = [box(a), box(b)];
  return p.x < q.x + TABLE_WIDTH && q.x < p.x + TABLE_WIDTH && p.y < q.y + q.h && q.y < p.y + p.h;
};

describe('placeTables', () => {
  it('keeps stored positions, drops gone tables and places the rest without overlapping', () => {
    const placed = placeTables(model, { users: { x: 10, y: 20 }, gone: { x: 0, y: 0 } });
    expect(placed.users).toEqual({ x: 10, y: 20 });
    expect(placed.gone).toBeUndefined();
    expect(Object.keys(placed).sort()).toEqual(['items', 'orders', 'users']);
    expect(overlaps(placed, 'users', 'orders')).toBe(false);
    expect(overlaps(placed, 'users', 'items')).toBe(false);
    expect(overlaps(placed, 'orders', 'items')).toBe(false);
  });

  it('gives a renamed table a new place', () => {
    const renamed: DiagramModel = { ...model, tables: [{ ...model.tables[0], name: 'people' }, ...model.tables.slice(1)] };
    const placed = placeTables(renamed, { users: { x: 10, y: 20 } });
    expect(placed.users).toBeUndefined();
    expect(placed.people).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it('leaves the positions object alone when every table is already placed', () => {
    const positions = { users: { x: 0, y: 0 }, orders: { x: 400, y: 0 }, items: { x: 800, y: 0 } };
    expect(placeTables(model, positions)).toBe(positions);
  });
});

describe('tidyLayout', () => {
  it('places every table with none overlapping', () => {
    const tidy = tidyLayout(model);
    expect(Object.keys(tidy).sort()).toEqual(['items', 'orders', 'users']);
    expect(overlaps(tidy, 'users', 'orders') || overlaps(tidy, 'users', 'items') || overlaps(tidy, 'orders', 'items')).toBe(false);
  });

  it('is fine with no tables', () => {
    expect(tidyLayout({ tables: [], refs: [] })).toEqual({});
  });
});
