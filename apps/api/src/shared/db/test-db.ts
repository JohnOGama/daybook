import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './create-db.ts';
import * as schema from './schema.ts';

export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url)) });
  return db as unknown as Db;
}

export async function insertSpace(db: Db, userId: string): Promise<string> {
  const [space] = await db
    .insert(schema.spaces)
    .values({ userId, kind: 'space', title: 'Space', tool: 'list' })
    .returning();
  return space.id;
}

export async function insertUser(db: Db, id: string): Promise<void> {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com` });
}
