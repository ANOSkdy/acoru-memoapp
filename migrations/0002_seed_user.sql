insert into users (email, display_name, password_hash)
values (
  'lacoru43oo@gmail.com',
  'lacoru43oo',
  'scrypt$16384$8$1$hX6LMWc3ohLGHzzI4ZzEYQ==$s5VJxSoFFeOiM8G/2hmwQfxX4nSnz+yNHwvmymV6r6Jy8pV4KA2MFD5TCR7jUj4zbsXeHhX5UxeJo1DAOow0IQ=='
)
on conflict (email)
  do update set
    display_name = excluded.display_name,
    password_hash = excluded.password_hash;
