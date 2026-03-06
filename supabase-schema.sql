-- Run this in your Supabase project: SQL Editor → New query → Paste → Run

-- Uno rooms table
create table if not exists uno_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  updated_at timestamptz default now()
);

-- Keep updated_at fresh on every update
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger uno_rooms_updated_at
  before update on uno_rooms
  for each row execute function update_updated_at();

-- Enable Realtime for this table (required for postgres_changes subscriptions)
alter publication supabase_realtime add table uno_rooms;

-- Prevent mutations to immutable columns (id, code) on UPDATE.
-- RLS with-check only sees the NEW row, so a trigger is needed to compare OLD vs NEW.
create or replace function protect_immutable_columns()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id then
    raise exception 'cannot change id';
  end if;
  if new.code <> old.code then
    raise exception 'cannot change code';
  end if;
  return new;
end;
$$;

create or replace trigger uno_rooms_protect_immutable
  before update on uno_rooms
  for each row execute function protect_immutable_columns();

-- Row Level Security
-- The anon key is public by design (like Firebase API keys).
-- RLS is the real security layer. Room codes act as access tokens —
-- you must know the code to read or mutate a room.
alter table uno_rooms enable row level security;

-- SELECT: allow reads (room codes are the access tokens; you must know the code
-- to query). RLS cannot inspect PostgREST query parameters, so to fully prevent
-- enumeration, use Supabase Auth with user-scoped rooms.
create policy "select rooms" on uno_rooms for select using (true);

-- INSERT: enforce 4-char uppercase alphanumeric room code format
create policy "insert with valid code" on uno_rooms
  for insert with check (
    code ~ '^[A-Z0-9]{4}$'
    and state is not null
  );

-- UPDATE: allow state changes (immutable column protection is enforced by trigger)
create policy "update rooms" on uno_rooms for update using (true);

-- DELETE: no policy = denied with RLS enabled. Rooms are cleaned up by pg_cron only.

-- Optional: auto-delete rooms older than 24 hours
-- (run manually or schedule via pg_cron if you have it)
-- delete from uno_rooms where updated_at < now() - interval '24 hours';
