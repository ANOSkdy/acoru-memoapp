create table if not exists webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter integer not null default 0,
  transports text[],
  created_at timestamptz not null default now()
);

create table if not exists webauthn_challenges (
  session_token text not null,
  type text not null check (type in ('registration', 'authentication')),
  challenge text not null,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  primary key (session_token, type)
);

create table if not exists webauthn_stepups (
  session_token text primary key,
  verified_at timestamptz not null default now()
);
