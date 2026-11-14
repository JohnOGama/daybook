import { exporter, importer, Parser } from '@dbml/core';
import type { ColumnRef, Dialect, DiagramModel, Problem, Ref } from './diagram-types';

export type ParseResult = { ok: true; model: DiagramModel } | { ok: false; problems: Problem[] };
export type ImportResult = { ok: true; dbml: string } | { ok: false; problems: Problem[] };

type Diagnostic = { message?: string; text?: string; location?: { start?: { line?: number } } };
type Endpoint = { schemaName: string | null; tableName: string; fieldNames: string[]; relation: '1' | '*' };

function problemsOf(error: unknown): Problem[] {
  const diags = (error as { diags?: Diagnostic[] } | null)?.diags;
  const list: Diagnostic[] = diags?.length ? diags : [{ message: (error as Error | null)?.message }];
  return list.map((diag) => ({ line: diag.location?.start?.line ?? 1, message: diag.message ?? diag.text ?? 'This could not be read.' }));
}

// Tables outside the default schema keep their schema in the name, so `sales.orders` and `orders` stay apart.
const qualified = (schema: string | null | undefined, table: string) => (schema && schema !== 'public' ? `${schema}.${table}` : table);
const columnOf = (end: Endpoint): ColumnRef => ({ table: qualified(end.schemaName, end.tableName), column: end.fieldNames[0] });

// Points every relationship from the referring column, whichever order @dbml/core lists the two ends in.
function toRef([first, second]: Endpoint[]): Ref {
  if (first.relation === '*' && second.relation === '*') return { from: columnOf(first), to: columnOf(second), kind: 'manyToMany' };
  if (first.relation === '1' && second.relation === '1') return { from: columnOf(second), to: columnOf(first), kind: 'oneToOne' };
  const [many, one] = first.relation === '*' ? [first, second] : [second, first];
  return { from: columnOf(many), to: columnOf(one), kind: 'manyToOne' };
}

export function parseDiagram(text: string): ParseResult {
  if (!text.trim()) return { ok: true, model: { tables: [], refs: [] } };
  try {
    const database = new Parser().parse(text, 'dbmlv2');
    const tables = database.schemas.flatMap((schema) =>
      schema.tables.map((table) => ({
        name: qualified(schema.name, table.name),
        columns: table.fields.map((field) => ({
          name: field.name,
          type: field.type.type_name,
          pk: Boolean(field.pk),
          unique: Boolean(field.unique),
          notNull: Boolean(field.not_null),
        })),
      })),
    );
    const refs = database.schemas.flatMap((schema) => schema.refs.map((ref) => toRef(ref.endpoints as unknown as Endpoint[])));
    return { ok: true, model: { tables, refs } };
  } catch (error) {
    return { ok: false, problems: problemsOf(error) };
  }
}

export function importSchema(text: string, format: 'dbml' | Dialect): ImportResult {
  if (!text.trim()) return { ok: false, problems: [{ line: 1, message: 'Paste a schema to import.' }] };
  if (format === 'dbml') {
    const parsed = parseDiagram(text);
    return parsed.ok ? { ok: true, dbml: text } : parsed;
  }
  try {
    const dbml = importer.import(text, format);
    return dbml.trim() ? { ok: true, dbml } : { ok: false, problems: [{ line: 1, message: 'No tables were found in that SQL.' }] };
  } catch (error) {
    return { ok: false, problems: problemsOf(error) };
  }
}

export const exportSql = (dbml: string, dialect: Dialect): string => exporter.export(dbml, dialect);

// Equal tables and refs mean the canvas has nothing to redraw (a comment or blank line was typed, say).
export const sameModel = (a: DiagramModel, b: DiagramModel): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);
