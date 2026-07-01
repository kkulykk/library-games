-- Migration: Secure RLS policies for uno_rooms
-- Run this in your Supabase project: SQL Editor → New query → Paste → Run
--
-- What this does:
-- 1. Drops the old overly-permissive RLS policies
-- 2. Adds a trigger to prevent mutations to id/code columns on UPDATE
-- 3. Creates tighter INSERT policy (enforces room code format)
-- 4. Keeps SELECT/UPDATE permissive (room codes are the access tokens)
-- 5. DELETE remains blocked (no policy = denied with RLS enabled)

begin;

-- 1. Drop old permissive policies
drop policy if exists "public select" on uno_rooms;
drop policy if exists "public insert" on uno_rooms;
drop policy if exists "public update" on uno_rooms;

-- 2. Protect immutable columns via trigger (RLS can't compare OLD vs NEW)
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

-- 3. New RLS policies
create policy "select rooms" on uno_rooms for select using (true);

create policy "insert with valid code" on uno_rooms
  for insert with check (
    code ~ '^[A-Z0-9]{4}$'
    and state is not null
  );

create policy "update rooms" on uno_rooms for update using (true);

-- No DELETE policy — denied by default with RLS enabled.

commit;
