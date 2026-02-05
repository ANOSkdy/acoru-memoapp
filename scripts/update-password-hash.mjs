import { neon } from "@neondatabase/serverless";

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

if (!url) throw new Error("Missing DATABASE_URL(_UNPOOLED)/DATABASE_URL/NEON_DATABASE_URL");

const email = process.env.EMAIL;
const hash = process.env.PWHASH;

if (!email) throw new Error("Missing EMAIL");
if (!hash) throw new Error("Missing PWHASH");

const sql = neon(url);

// update
await sql`
  update users
  set password_hash = ${hash}
  where email = ${email}
`;

// verify
const r = await sql`
  select email, length(password_hash) as pw_len, left(password_hash, 12) as pw_prefix
  from users
  where email = ${email}
`;

console.log(r[0] ?? null);
