-- Run this in your Supabase project: SQL Editor → New query → Paste → Run

-- Uno rooms table
create table if not exists uno_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  updated_at timestamptz default now()
);

-- Keep updated_at fresh on every update
-- SECURITY DEFINER + fixed search_path prevents search path hijacking
create or replace function update_updated_at()
returns trigger language plpgsql
security definer set search_path = ''
as $$
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

-- Row Level Security — room codes act as the access token
alter table uno_rooms enable row level security;

create policy "public select" on uno_rooms for select using (true);

create policy "public insert" on uno_rooms for insert with check (
  code is not null and
  length(code) = 4 and
  state is not null
);

create policy "public update" on uno_rooms for update using (
  code is not null
) with check (
  state is not null
);

-- Auto-delete rooms older than 24 hours via pg_cron (runs every hour)
-- Requires: create extension if not exists pg_cron;
-- select cron.schedule('delete-old-uno-rooms', '0 * * * *',
--   $$delete from uno_rooms where updated_at < now() - interval '24 hours'$$);
