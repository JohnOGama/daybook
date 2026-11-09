import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const folder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
const migrations = readdirSync(folder)
  .filter((name) => name.endsWith('.sql'))
  .sort();

async function run(db: PGlite, file: string) {
  const statements = readFileSync(`${folder}/${file}`, 'utf8').split('--> statement-breakpoint');
  for (const statement of statements) await db.exec(statement);
}

it('moves existing tasks into a "My List" space for each user who has tasks', async () => {
  const db = new PGlite();
  await run(db, migrations[0]);
  await db.exec(`
    insert into "user" (id, name, email) values
      ('a', 'a', 'a@x.y'), ('b', 'b', 'b@x.y'), ('c', 'c', 'c@x.y');
    insert into tasks (id, user_id, title, planned_day) values
      ('11111111-1111-4111-8111-111111111111', 'a', 'parent', '2026-11-09'),
      ('22222222-2222-4222-8222-222222222222', 'b', 'other', '2026-11-09');
    insert into tasks (user_id, parent_id, title) values
      ('a', '11111111-1111-4111-8111-111111111111', 'child');
  `);
  for (const file of migrations.slice(1)) await run(db, file);

  const created = await db.query<{ user_id: string; kind: string; title: string; tool: string }>(
    'select user_id, kind, title, tool from spaces order by user_id',
  );
  expect(created.rows).toEqual([
    { user_id: 'a', kind: 'space', title: 'My List', tool: 'list' },
    { user_id: 'b', kind: 'space', title: 'My List', tool: 'list' },
  ]);

  const moved = await db.query<{ count: number }>(
    `select count(*)::int as count from tasks t join spaces s on s.id = t.space_id where s.user_id = t.user_id`,
  );
  expect(moved.rows[0].count).toBe(3);
});
