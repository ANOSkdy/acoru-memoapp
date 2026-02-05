alter table if exists users
  add column if not exists role text not null default 'user';

alter table if exists users
  add column if not exists must_change_password boolean not null default false;

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
