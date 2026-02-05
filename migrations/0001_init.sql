create extension if not exists pgcrypto;

create table if not exists workspace_users (
  id text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table if exists users
  add column if not exists email text;

alter table if exists users
  add column if not exists display_name text;

alter table if exists users
  add column if not exists password_hash text;

alter table if exists users
  add column if not exists created_at timestamptz not null default now();

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references workspace_users(id) on delete cascade,
  title text not null,
  body text not null,
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on notes (user_id);
create index if not exists notes_favorite_idx on notes (is_favorite);
create index if not exists notes_updated_at_idx on notes (updated_at desc);
create unique index if not exists users_email_idx on users (email);
create index if not exists sessions_user_id_idx on sessions (user_id);
create index if not exists sessions_token_hash_idx on sessions (token_hash);
