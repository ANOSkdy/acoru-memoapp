import { neon } from "@neondatabase/serverless";

const url =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

if (!url) {
  throw new Error("Missing DATABASE_URL(_UNPOOLED)/DATABASE_URL/NEON_DATABASE_URL");
}

const sql = neon(url);

// DB疎通
const now = await sql`select now() as now`;
console.log("DB now:", now[0].now);

// 任意: ユーザー確認
if (process.env.EMAIL) {
  const u = await sql`
    select id, email, display_name,
           length(password_hash) as pw_len,
           left(password_hash, 20) as pw_prefix
    from users
    where email = ${process.env.EMAIL}
  `;
  console.log("User:", u[0]);
}

// sessions の有無
const s = await sql`select to_regclass('public.sessions') as sessions_table`;
console.log("sessions_table:", s[0].sessions_table);
