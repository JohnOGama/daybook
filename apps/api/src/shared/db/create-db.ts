import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema.ts';

export const DB = Symbol('DB');

export type Db = PgDatabase<any, typeof schema>;

export function createDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url });
  pool.on('error', (error) => console.error('Idle database connection failed', error));
  return drizzle(pool, { schema });
}
