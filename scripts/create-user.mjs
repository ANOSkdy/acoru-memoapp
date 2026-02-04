import { neon } from '@neondatabase/serverless';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
};

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email') {
      args.email = argv[i + 1];
      i += 1;
    } else if (arg === '--password') {
      args.password = argv[i + 1];
      i += 1;
    }
  }
  return args;
};

const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64'),
    derivedKey.toString('base64')
  ].join('$');
};

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  console.error('Missing DATABASE_URL_UNPOOLED, DATABASE_URL, or NEON_DATABASE_URL.');
  process.exit(1);
}

const { email, password } = parseArgs(process.argv.slice(2));

if (!email || !password) {
  console.error('Usage: pnpm user:create -- --email you@example.com --password "secret"');
  process.exit(1);
}

const main = async () => {
  const sql = neon(databaseUrl);
  const passwordHash = await hashPassword(password);
  const displayName = email.split('@')[0];

  await sql`
    insert into users (email, display_name, password_hash)
    values (${email.toLowerCase()}, ${displayName}, ${passwordHash})
    on conflict (email)
    do update set password_hash = ${passwordHash}, display_name = ${displayName};
  `;

  console.log(`User ${email} created/updated.`);
};

main().catch((error) => {
  console.error('Failed to create user:', error);
  process.exit(1);
});
