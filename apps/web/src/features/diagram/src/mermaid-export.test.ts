import { describe, expect, it } from 'vitest';
import type { DiagramModel, RefKind } from './diagram-types';
import { toMermaid } from './mermaid-export';

const column = (name: string, type: string, flags: { pk?: boolean; unique?: boolean } = {}) => ({ name, type, pk: false, unique: false, notNull: false, ...flags });

const shop: DiagramModel = {
  tables: [
    { name: 'users', columns: [column('id', 'int', { pk: true }), column('email', 'varchar', { unique: true })] },
    { name: 'orders', columns: [column('id', 'int', { pk: true }), column('user_id', 'int')] },
  ],
  refs: [{ from: { table: 'orders', column: 'user_id' }, to: { table: 'users', column: 'id' }, kind: 'manyToOne' }],
};

describe('toMermaid', () => {
  it('writes each table with its columns and keys', () => {
    const text = toMermaid(shop);
    expect(text.startsWith('erDiagram\n')).toBe(true);
    expect(text).toContain('  users {\n    int id PK\n    varchar email UK\n  }');
    expect(text).toContain('    int user_id FK');
  });

  it('marks each relationship with its cardinality', () => {
    expect(toMermaid(shop)).toContain('  orders }o--|| users : "user_id"');
    const withKind = (kind: RefKind) => toMermaid({ ...shop, refs: [{ ...shop.refs[0], kind }] });
    expect(withKind('oneToOne')).toContain('orders ||--|| users');
    expect(withKind('manyToMany')).toContain('orders }o--o{ users');
  });

  it('turns names and types Mermaid cannot take into safe ones', () => {
    const odd: DiagramModel = {
      tables: [
        { name: 'order items', columns: [column('unit price', 'varchar(255)')] },
        { name: 'public.users', columns: [column('id', 'int', { pk: true })] },
      ],
      refs: [{ from: { table: 'order items', column: 'unit price' }, to: { table: 'public.users', column: 'id' }, kind: 'manyToOne' }],
    };
    const text = toMermaid(odd);
    expect(text).toContain('  order_items {\n    varchar_255 unit_price FK\n  }');
    expect(text).toContain('  public_users {');
    expect(text).toContain('order_items }o--|| public_users : "unit price"');
  });
});
