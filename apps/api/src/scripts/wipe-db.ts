// Deletes every row in every table, including users and the built-in foods and exercises. Migrations are kept.
// Usage: pnpm --filter api db:wipe --yes
import { sql } from 'drizzle-orm';
import { createDb } from '../shared/db/create-db.ts';

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in apps/api/.env first.');
  process.exit(1);
}

if (!process.argv.includes('--yes')) {
  console.error(`This deletes ALL data in ${new URL(process.env.DATABASE_URL).host}. Run again with --yes to confirm.`);
  process.exit(1);
}

await createDb(process.env.DATABASE_URL).execute(sql`
  DO $$ DECLARE tables text;
  BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables FROM pg_tables WHERE schemaname = 'public';
    IF tables IS NOT NULL THEN EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE'; END IF;
  END $$;
`);
console.log('Deleted all data.');
process.exit(0);
