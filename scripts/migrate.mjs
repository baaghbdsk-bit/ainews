// Applies every SQL file in supabase/migrations once, in filename order.
//
//   Local:  npm run db:migrate      (reads DATABASE_URL from .env.local)
//   CI:     node scripts/migrate.mjs (reads DATABASE_URL from the environment)
//
// Applied migrations are recorded in public.schema_migrations, so re-running is
// a no-op. Each file runs in its own transaction: it either applies fully or
// not at all.

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    'DATABASE_URL is not set.\n' +
      'Add it to .env.local (Project Settings -> Database -> Connection string),\n' +
      'or set it in the environment / as a GitHub secret.',
  );
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'supabase', 'migrations');

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('No migration files found.');
  process.exit(0);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);
const client = new Client({
  connectionString: databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename   text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query('select filename from public.schema_migrations');
  const applied = new Set(rows.map((row) => row.filename));

  let ranAny = false;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`apply  ${file} ... `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into public.schema_migrations (filename) values ($1)', [file]);
      await client.query('commit');
      console.log('ok');
      ranAny = true;
    } catch (error) {
      await client.query('rollback');
      console.log('FAILED');
      throw error;
    }
  }

  console.log(ranAny ? 'Migrations applied.' : 'Database already up to date.');
} finally {
  await client.end();
}
