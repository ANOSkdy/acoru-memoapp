create table if not exists todos (
  id bigserial primary key,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists todos_created_at_idx on todos (created_at desc);
