export type Column = { name: string; type: string; pk: boolean; unique: boolean; notNull: boolean };
export type Table = { name: string; columns: Column[] };
export type RefKind = 'manyToOne' | 'oneToMany' | 'oneToOne' | 'manyToMany';
export type ColumnRef = { table: string; column: string };
// `from` is the referring column (the "many" side when there is one), `to` the column it points at.
export type Ref = { from: ColumnRef; to: ColumnRef; kind: RefKind };
export type DiagramModel = { tables: Table[]; refs: Ref[] };
export type Problem = { line: number; message: string };
export type Point = { x: number; y: number };
export type Positions = Record<string, Point>;
export type Dialect = 'postgres' | 'mysql' | 'mssql';

export const EMPTY_MODEL: DiagramModel = { tables: [], refs: [] };
