import { describe, expect, it } from 'vitest';
import { dbmlProblem } from './dbml-check.ts';

describe('dbmlProblem', () => {
  it('is null for DBML that parses', () => {
    expect(dbmlProblem('Table users { id int [pk] }')).toBeNull();
  });

  it('names the line of a syntax error or a broken reference', () => {
    expect(dbmlProblem('Table users { id int [pk]')).toMatch(/^Line 1: /);
    expect(dbmlProblem('Table a {\n  id int [ref: > missing.id]\n}')).toMatch(/^Line 2: .*missing/);
  });
});

