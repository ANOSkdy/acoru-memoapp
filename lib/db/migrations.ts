import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from '@/lib/db';

const splitStatements = (contents: string) =>
  contents
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);

let migrationPromise: Promise<void> | null = null;

const runMigrations = async () => {
  if (!sql) {
    return;
  }

  await sql`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `;

  const appliedRows = await sql`select id from schema_migrations order by id`;
  const applied = new Set(appliedRows.map((row) => row.id));

  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const contents = await readFile(path.join(migrationsDir, file), 'utf8');
    const statements = splitStatements(contents);
    if (statements.length === 0) {
      continue;
    }

    for (const statement of statements) {
      await sql(statement);
    }
    await sql`insert into schema_migrations (id) values (${file})`;
  }
};

export const ensureMigrations = async () => {
  if (!migrationPromise) {
    migrationPromise = runMigrations().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
};
