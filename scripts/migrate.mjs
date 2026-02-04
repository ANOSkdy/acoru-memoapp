import { neon } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  console.error(
    'Missing DATABASE_URL_UNPOOLED, DATABASE_URL, or NEON_DATABASE_URL.'
  );
  process.exit(1);
}

const sql = neon(databaseUrl);

const migrationsDir = path.join(process.cwd(), 'migrations');

const ensureSchemaTable = async () => {
  await sql`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `;
};

const getAppliedMigrations = async () => {
  const rows = await sql`select id from schema_migrations order by id`;
  return new Set(rows.map((row) => row.id));
};

const runMigration = async (id, statements) => {
  console.log(`Applying ${id}...`);
  for (const statement of statements) {
    await sql(statement);
  }
  await sql`insert into schema_migrations (id) values (${id})`;
};

const splitStatements = (contents) =>
  contents
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);

const main = async () => {
  await ensureSchemaTable();
  const applied = await getAppliedMigrations();

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
      console.log(`Skipping empty migration ${file}.`);
      continue;
    }
    await runMigration(file, statements);
  }

  console.log('Migrations complete.');
};

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
