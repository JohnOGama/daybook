import { describe, expect, it } from 'vitest';
import { exportSql, importSchema, parseDiagram } from './dbml-model';
import type { DiagramModel } from './diagram-types';
import { SHOP } from './test-fixtures';


const model = (text: string): DiagramModel => {
  const result = parseDiagram(text);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.model;
};

describe('parseDiagram', () => {
  it('reads tables, columns and their keys', () => {
    const { tables } = model(SHOP);
    expect(tables.map(({ name }) => name)).toEqual(['users', 'orders', 'order_items']);
    expect(tables[0].columns).toEqual([
      { name: 'id', type: 'int', pk: true, unique: false, notNull: false },
      { name: 'email', type: 'varchar', pk: false, unique: true, notNull: true },
    ]);
  });

  it('reads inline refs and Ref blocks, pointing from the referring column', () => {
    expect(model(SHOP).refs).toEqual([
      { from: { table: 'orders', column: 'user_id' }, to: { table: 'users', column: 'id' }, kind: 'manyToOne' },
      { from: { table: 'order_items', column: 'order_id' }, to: { table: 'orders', column: 'id' }, kind: 'manyToOne' },
    ]);
  });

  it('turns < around, and reads one-to-one and many-to-many', () => {
    const base = 'Table a { id int [pk] }\nTable b {\n  id int [pk]\n  a_id int\n}\n';
    expect(model(`${base}Ref: a.id < b.a_id`).refs[0]).toEqual({ from: { table: 'b', column: 'a_id' }, to: { table: 'a', column: 'id' }, kind: 'manyToOne' });
    expect(model(`${base}Ref: b.a_id - a.id`).refs[0].kind).toBe('oneToOne');
    expect(model(`${base}Ref: b.a_id <> a.id`).refs[0].kind).toBe('manyToMany');
  });

  it('names tables outside the public schema with their schema', () => {
    expect(model('Table sales.orders { id int }').tables[0].name).toBe('sales.orders');
  });

  it('reports problems with their line, and reads empty text as an empty diagram', () => {
    expect(parseDiagram('Table users {')).toEqual({ ok: false, problems: [expect.objectContaining({ line: 1 })] });
    const broken = parseDiagram('Table a {\n  id int [ref: > missing.id]\n}');
    expect(broken.ok).toBe(false);
    expect(!broken.ok && broken.problems[0]).toMatchObject({ line: 2, message: expect.stringContaining('missing') });
    expect(parseDiagram('')).toEqual({ ok: true, model: { tables: [], refs: [] } });
  });
});

describe('importSchema', () => {
  it('turns SQL into DBML that reads back', () => {
    const result = importSchema('CREATE TABLE users (id serial PRIMARY KEY, email varchar(255) UNIQUE);', 'postgres');
    expect(result.ok).toBe(true);
    expect(result.ok && model(result.dbml).tables[0].name).toBe('users');
  });

  it('reports SQL it cannot read, and refuses an empty box', () => {
    expect(importSchema('CREATE TABL oops', 'postgres')).toEqual({ ok: false, problems: [expect.objectContaining({ line: 1 })] });
    expect(importSchema('', 'mysql')).toEqual({ ok: false, problems: [{ line: 1, message: 'Paste a schema to import.' }] });
    expect(importSchema('Table users {', 'dbml').ok).toBe(false);
  });
});

describe('exportSql', () => {
  it('writes CREATE TABLE for each database', () => {
    const postgres = exportSql(SHOP, 'postgres');
    expect(postgres).toContain('CREATE TABLE "users"');
    expect(postgres).toContain('FOREIGN KEY');
    expect(exportSql(SHOP, 'mysql')).toContain('CREATE TABLE `users`');
    expect(exportSql(SHOP, 'mssql')).toContain('CREATE TABLE [users]');
  });
});
