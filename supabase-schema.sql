-- Run this in your Supabase project: SQL Editor → New query → Paste → Run

-- Uno rooms table
create table if not exists uno_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
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
returns trigger language plpgsql
set search_path = ''
as $$
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

-- INSERT: enforce 6-char Crockford base-32 room code format
create policy "insert with valid code" on uno_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );

-- UPDATE: allow state changes (immutable column protection is enforced by trigger)
create policy "update rooms" on uno_rooms for update using (true);

-- DELETE: no policy = denied with RLS enabled. Rooms are cleaned up by pg_cron only.

-- Optional: auto-delete rooms older than 24 hours
-- (run manually or schedule via pg_cron if you have it)
-- delete from uno_rooms where updated_at < now() - interval '24 hours';

-- ─── Skribbl rooms table ──────────────────────────────────────────────────────

create table if not exists skribbl_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz default now()
);

create or replace trigger skribbl_rooms_updated_at
  before update on skribbl_rooms
  for each row execute function update_updated_at();

create or replace trigger skribbl_rooms_protect_immutable
  before update on skribbl_rooms
  for each row execute function protect_immutable_columns();

alter publication supabase_realtime add table skribbl_rooms;

alter table skribbl_rooms enable row level security;

create policy "select skribbl rooms" on skribbl_rooms for select using (true);

create policy "insert skribbl rooms" on skribbl_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );

create policy "update skribbl rooms" on skribbl_rooms for update using (true);

-- delete from skribbl_rooms where updated_at < now() - interval '24 hours';

-- ─── Agar.io rooms table ────────────────────────────────────────────────────

create table if not exists agario_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz default now()
);

create or replace trigger agario_rooms_updated_at
  before update on agario_rooms
  for each row execute function update_updated_at();

create or replace trigger agario_rooms_protect_immutable
  before update on agario_rooms
  for each row execute function protect_immutable_columns();

alter publication supabase_realtime add table agario_rooms;

alter table agario_rooms enable row level security;

create policy "select agario rooms" on agario_rooms for select using (true);

create policy "insert agario rooms" on agario_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );

create policy "update agario rooms" on agario_rooms for update using (true);

-- delete from agario_rooms where updated_at < now() - interval '24 hours';

-- ─── Cards Against Humanity rooms table ─────────────────────────────────────

create table if not exists cah_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz default now()
);

create or replace trigger cah_rooms_updated_at
  before update on cah_rooms
  for each row execute function update_updated_at();

create or replace trigger cah_rooms_protect_immutable
  before update on cah_rooms
  for each row execute function protect_immutable_columns();

alter publication supabase_realtime add table cah_rooms;

alter table cah_rooms enable row level security;

create policy "select cah rooms" on cah_rooms for select using (true);

create policy "insert cah rooms" on cah_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );

create policy "update cah rooms" on cah_rooms for update using (true);

-- delete from cah_rooms where updated_at < now() - interval '24 hours';

-- ─── Codenames rooms table ───────────────────────────────────────────────────

create table if not exists codenames_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz default now()
);

create or replace trigger codenames_rooms_updated_at
  before update on codenames_rooms
  for each row execute function update_updated_at();

create or replace trigger codenames_rooms_protect_immutable
  before update on codenames_rooms
  for each row execute function protect_immutable_columns();

alter publication supabase_realtime add table codenames_rooms;

alter table codenames_rooms enable row level security;

create policy "select codenames rooms" on codenames_rooms for select using (true);

create policy "insert codenames rooms" on codenames_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );

create policy "update codenames rooms" on codenames_rooms for update using (true);

-- delete from codenames_rooms where updated_at < now() - interval '24 hours';

-- ─── Mindmeld rooms table ───────────────────────────────────────────────────

create table if not exists mindmeld_rooms (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz default now()
);

create or replace trigger mindmeld_rooms_updated_at
  before update on mindmeld_rooms
  for each row execute function update_updated_at();

create or replace trigger mindmeld_rooms_protect_immutable
  before update on mindmeld_rooms
  for each row execute function protect_immutable_columns();

alter publication supabase_realtime add table mindmeld_rooms;

alter table mindmeld_rooms enable row level security;

create policy "select mindmeld rooms" on mindmeld_rooms for select using (true);

create policy "insert mindmeld rooms" on mindmeld_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );

create policy "update mindmeld rooms" on mindmeld_rooms for update using (true);

-- delete from mindmeld_rooms where updated_at < now() - interval '24 hours';

-- ─── Migration: add version column to existing tables ───────────────────────
-- Run this once if your tables already exist (the CREATE TABLE statements above
-- include the column for fresh installs).

-- alter table uno_rooms     add column if not exists version integer not null default 1;
-- alter table skribbl_rooms add column if not exists version integer not null default 1;
-- alter table agario_rooms  add column if not exists version integer not null default 1;
-- alter table cah_rooms     add column if not exists version integer not null default 1;

-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2 (ADDITIVE): member-scoped RPCs, broadcast delivery, server-side
-- validation. Everything below is additive — the permissive `using(true)`
-- SELECT/UPDATE policies above stay in place (sealing is Phase 3, never this
-- phase). Each block is independently reversible (drop column / drop trigger /
-- drop function) and does not break in-flight rooms or stale cached clients.
-- Applied identically across all 6 room tables from one templated source
-- (MIGR-03 / D-15).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── room_token column (×6) ─────────────────────────────────────────────────
-- The per-room write capability (D-01). UUID v4 = ~122 bits CSPRNG, server-
-- minted, never in the invite URL. `add column if not exists ... default
-- gen_random_uuid()` backfills existing rows so live pre-migration rooms get a
-- token (Runtime State Inventory).

alter table public.uno_rooms       add column if not exists room_token uuid not null default gen_random_uuid();
alter table public.skribbl_rooms   add column if not exists room_token uuid not null default gen_random_uuid();
alter table public.agario_rooms    add column if not exists room_token uuid not null default gen_random_uuid();
alter table public.cah_rooms       add column if not exists room_token uuid not null default gen_random_uuid();
alter table public.codenames_rooms add column if not exists room_token uuid not null default gen_random_uuid();
alter table public.mindmeld_rooms  add column if not exists room_token uuid not null default gen_random_uuid();

-- ─── Shared broadcast trigger function ───────────────────────────────────────
-- Emits the full {state, version} on the PUBLIC topic `room:CODE` after every
-- state UPDATE (ACCESS-05, D-09 full payload, D-11 secret-topic model). The 4th
-- arg to realtime.send MUST be `false` → PUBLIC channel that any anon client may
-- subscribe to without a JWT or RLS on realtime.messages. Do NOT use
-- realtime.broadcast_changes() (hardwired private) and do NOT pass true here.
-- search_path = '' forces fully-qualified public./realtime. names (lint 0011).

create or replace function public.broadcast_room_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('state', new.state, 'version', new.version),
    'state',                       -- event name (client .on('broadcast',{event:'state'}))
    'room:' || new.code,           -- topic = the room code (the secret)
    false                          -- private=false → PUBLIC channel (anon-subscribable)
  );
  return null;
end;
$$;

-- ─── Per-table broadcast triggers (×6) ───────────────────────────────────────

create or replace trigger uno_rooms_broadcast_state after update on public.uno_rooms
  for each row execute function public.broadcast_room_state();

create or replace trigger skribbl_rooms_broadcast_state after update on public.skribbl_rooms
  for each row execute function public.broadcast_room_state();

create or replace trigger agario_rooms_broadcast_state after update on public.agario_rooms
  for each row execute function public.broadcast_room_state();

create or replace trigger cah_rooms_broadcast_state after update on public.cah_rooms
  for each row execute function public.broadcast_room_state();

create or replace trigger codenames_rooms_broadcast_state after update on public.codenames_rooms
  for each row execute function public.broadcast_room_state();

create or replace trigger mindmeld_rooms_broadcast_state after update on public.mindmeld_rooms
  for each row execute function public.broadcast_room_state();

-- ─── Server-side player-name validation helper (INPUT-01, D-05) ──────────────
-- A name is valid iff, after trim, its length is 1..20 AND it contains no
-- character in Unicode categories Cc (control), Cf (format), Zl (line
-- separator) or Zp (paragraph separator). Everything else — unicode letters,
-- digits, punctuation, emoji — is allowed (the real risks for a casual arcade
-- are length-DoS and blank/invisible names; React escapes rendered output).
-- Client Zod is a SUBSET of this accept-set (INPUT-03: client ⊆ Postgres).
-- MUST accept "Roman", "ローマン", "player 🎮", "x_42"; MUST reject empty /
-- all-whitespace, 21+ chars, control and zero-width characters.
-- search_path = '' → fully-qualified names below.
create or replace function public.is_valid_player_name(p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trimmed text;
begin
  if p_name is null then
    return false;
  end if;
  v_trimmed := btrim(p_name);
  -- length 1..20 after trim (char_length counts multibyte/emoji as 1)
  if char_length(v_trimmed) < 1 or char_length(v_trimmed) > 20 then
    return false;
  end if;
  -- Reject control characters: Cc = U+0000-001F, U+007F-009F (POSIX [:cntrl:]).
  if v_trimmed ~ '[[:cntrl:]]' then
    return false;
  end if;
  -- Reject Cf (format / zero-width), Zl, Zp and related invisible code points.
  -- The bracket class below contains the literal code points (Postgres POSIX
  -- regex matches the actual characters; \u escapes are not portable here):
  --   U+00AD soft hyphen, U+200B-200F zero-width + bidi marks, U+2028 line sep
  --   (Zl), U+2029 para sep (Zp), U+202A-202E bidi embeddings, U+2060-2064
  --   word-joiner group, U+FEFF BOM/ZWNBSP, U+FFF9-FFFB interlinear annotation.
  if v_trimmed ~ '[­​-‏  ‪-‮⁠-⁤﻿￹-￻]' then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.is_valid_player_name(text) from public;
grant execute on function public.is_valid_player_name(text) to anon;

-- ─── Member-scoped SECURITY DEFINER RPCs (×6 games) ──────────────────────────
-- Four RPCs per game (create / join / restore / dispatch). Every function:
--   * security definer + set search_path = '' + fully-qualified public. names
--     (ACCESS-04, clears Security Advisor lint 0011)
--   * revoke all from public; grant execute to anon only (scoped EXECUTE)
--   * re-checks the canonical 6-char Crockford code server-side (INPUT-02)
--   * validates every player name in the candidate state (INPUT-01, helper)
-- Errcodes (mapped to friendly UI strings by the hook — no raw DB errors):
--   22023 invalid code / invalid name | 42501 unauthorized (token / not member)
--   40001 version conflict (CAS). The reducer stays client-side; dispatch takes
--   p_new_state + p_expected_version and does the CAS (Open Question 1 RESOLVED).
-- All writes require code + room_token (D-02/D-03). join issues the token;
-- restore re-issues it iff p_player_id ∈ state.players (D-04).

-- ── uno_rooms ──────────────────────────────────────────────────────────────────

create or replace function public.create_uno(p_code text, p_state jsonb)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  return query
  insert into public.uno_rooms (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.uno_rooms.state, public.uno_rooms.version, public.uno_rooms.room_token;
end;
$$;

revoke all on function public.create_uno(text, jsonb) from public;
grant execute on function public.create_uno(text, jsonb) to anon;

create or replace function public.join_uno(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.uno_rooms;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  select * into v_row from public.uno_rooms where public.uno_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_row.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- CR-02: join is only valid in lobby and must add exactly one player without
  -- dropping an existing member, so join cannot overwrite live game state.
  if (v_row.state ->> 'phase') is distinct from 'lobby' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_new_state -> 'players') <> jsonb_array_length(v_row.state -> 'players') + 1 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as old_p
     where not exists (
       select 1 from jsonb_array_elements(p_new_state -> 'players') as new_p
        where new_p ->> 'id' = old_p ->> 'id'
     )
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- CAS: add the joining player by overwriting state at the expected version.
  return query
  update public.uno_rooms
     set state = p_new_state, version = public.uno_rooms.version + 1
   where public.uno_rooms.code = p_code
     and public.uno_rooms.version = p_expected_version
  returning public.uno_rooms.state, public.uno_rooms.version, public.uno_rooms.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_uno(text, jsonb, integer) from public;
grant execute on function public.join_uno(text, jsonb, integer) to anon;

create or replace function public.restore_uno(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.uno_rooms;
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.uno_rooms where public.uno_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04)
  select exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as p
     where p ->> 'id' = p_player_id
  ) into v_present;
  if not v_present then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- re-issue (return) the existing token so token-less sessions survive a reload
  return query select v_row.state, v_row.version, v_row.room_token;
end;
$$;

revoke all on function public.restore_uno(text, text) from public;
grant execute on function public.restore_uno(text, text) to anon;

create or replace function public.dispatch_uno(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.uno_rooms;
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.uno_rooms where public.uno_rooms.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.uno_rooms
     set state = p_new_state, version = public.uno_rooms.version + 1
   where public.uno_rooms.code = p_code
     and public.uno_rooms.version = p_expected_version
  returning public.uno_rooms.state, public.uno_rooms.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_uno(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_uno(text, uuid, jsonb, integer) to anon;

-- ── skribbl_rooms ──────────────────────────────────────────────────────────────────

create or replace function public.create_skribbl(p_code text, p_state jsonb)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  return query
  insert into public.skribbl_rooms (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.skribbl_rooms.state, public.skribbl_rooms.version, public.skribbl_rooms.room_token;
end;
$$;

revoke all on function public.create_skribbl(text, jsonb) from public;
grant execute on function public.create_skribbl(text, jsonb) to anon;

create or replace function public.join_skribbl(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.skribbl_rooms;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  select * into v_row from public.skribbl_rooms where public.skribbl_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_row.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- CR-02: join is only valid in lobby and must add exactly one player without
  -- dropping an existing member, so join cannot overwrite live game state.
  if (v_row.state ->> 'phase') is distinct from 'lobby' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_new_state -> 'players') <> jsonb_array_length(v_row.state -> 'players') + 1 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as old_p
     where not exists (
       select 1 from jsonb_array_elements(p_new_state -> 'players') as new_p
        where new_p ->> 'id' = old_p ->> 'id'
     )
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- CAS: add the joining player by overwriting state at the expected version.
  return query
  update public.skribbl_rooms
     set state = p_new_state, version = public.skribbl_rooms.version + 1
   where public.skribbl_rooms.code = p_code
     and public.skribbl_rooms.version = p_expected_version
  returning public.skribbl_rooms.state, public.skribbl_rooms.version, public.skribbl_rooms.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_skribbl(text, jsonb, integer) from public;
grant execute on function public.join_skribbl(text, jsonb, integer) to anon;

create or replace function public.restore_skribbl(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.skribbl_rooms;
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.skribbl_rooms where public.skribbl_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04)
  select exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as p
     where p ->> 'id' = p_player_id
  ) into v_present;
  if not v_present then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- re-issue (return) the existing token so token-less sessions survive a reload
  return query select v_row.state, v_row.version, v_row.room_token;
end;
$$;

revoke all on function public.restore_skribbl(text, text) from public;
grant execute on function public.restore_skribbl(text, text) to anon;

create or replace function public.dispatch_skribbl(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.skribbl_rooms;
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.skribbl_rooms where public.skribbl_rooms.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.skribbl_rooms
     set state = p_new_state, version = public.skribbl_rooms.version + 1
   where public.skribbl_rooms.code = p_code
     and public.skribbl_rooms.version = p_expected_version
  returning public.skribbl_rooms.state, public.skribbl_rooms.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_skribbl(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_skribbl(text, uuid, jsonb, integer) to anon;

-- ── agario_rooms ──────────────────────────────────────────────────────────────────

create or replace function public.create_agario(p_code text, p_state jsonb)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  return query
  insert into public.agario_rooms (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.agario_rooms.state, public.agario_rooms.version, public.agario_rooms.room_token;
end;
$$;

revoke all on function public.create_agario(text, jsonb) from public;
grant execute on function public.create_agario(text, jsonb) to anon;

create or replace function public.join_agario(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.agario_rooms;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  select * into v_row from public.agario_rooms where public.agario_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_row.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- CR-02: join is only valid in lobby and must add exactly one player without
  -- dropping an existing member, so join cannot overwrite live game state.
  if (v_row.state ->> 'phase') is distinct from 'lobby' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_new_state -> 'players') <> jsonb_array_length(v_row.state -> 'players') + 1 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as old_p
     where not exists (
       select 1 from jsonb_array_elements(p_new_state -> 'players') as new_p
        where new_p ->> 'id' = old_p ->> 'id'
     )
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- CAS: add the joining player by overwriting state at the expected version.
  return query
  update public.agario_rooms
     set state = p_new_state, version = public.agario_rooms.version + 1
   where public.agario_rooms.code = p_code
     and public.agario_rooms.version = p_expected_version
  returning public.agario_rooms.state, public.agario_rooms.version, public.agario_rooms.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_agario(text, jsonb, integer) from public;
grant execute on function public.join_agario(text, jsonb, integer) to anon;

create or replace function public.restore_agario(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.agario_rooms;
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.agario_rooms where public.agario_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04)
  select exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as p
     where p ->> 'id' = p_player_id
  ) into v_present;
  if not v_present then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- re-issue (return) the existing token so token-less sessions survive a reload
  return query select v_row.state, v_row.version, v_row.room_token;
end;
$$;

revoke all on function public.restore_agario(text, text) from public;
grant execute on function public.restore_agario(text, text) to anon;

create or replace function public.dispatch_agario(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.agario_rooms;
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.agario_rooms where public.agario_rooms.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.agario_rooms
     set state = p_new_state, version = public.agario_rooms.version + 1
   where public.agario_rooms.code = p_code
     and public.agario_rooms.version = p_expected_version
  returning public.agario_rooms.state, public.agario_rooms.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_agario(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_agario(text, uuid, jsonb, integer) to anon;

-- ── cah_rooms ──────────────────────────────────────────────────────────────────

create or replace function public.create_cah(p_code text, p_state jsonb)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  return query
  insert into public.cah_rooms (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.cah_rooms.state, public.cah_rooms.version, public.cah_rooms.room_token;
end;
$$;

revoke all on function public.create_cah(text, jsonb) from public;
grant execute on function public.create_cah(text, jsonb) to anon;

create or replace function public.join_cah(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.cah_rooms;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  select * into v_row from public.cah_rooms where public.cah_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_row.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- CR-02: join is only valid in lobby and must add exactly one player without
  -- dropping an existing member, so join cannot overwrite live game state.
  if (v_row.state ->> 'phase') is distinct from 'lobby' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_new_state -> 'players') <> jsonb_array_length(v_row.state -> 'players') + 1 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as old_p
     where not exists (
       select 1 from jsonb_array_elements(p_new_state -> 'players') as new_p
        where new_p ->> 'id' = old_p ->> 'id'
     )
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- CAS: add the joining player by overwriting state at the expected version.
  return query
  update public.cah_rooms
     set state = p_new_state, version = public.cah_rooms.version + 1
   where public.cah_rooms.code = p_code
     and public.cah_rooms.version = p_expected_version
  returning public.cah_rooms.state, public.cah_rooms.version, public.cah_rooms.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_cah(text, jsonb, integer) from public;
grant execute on function public.join_cah(text, jsonb, integer) to anon;

create or replace function public.restore_cah(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.cah_rooms;
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.cah_rooms where public.cah_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04)
  select exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as p
     where p ->> 'id' = p_player_id
  ) into v_present;
  if not v_present then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- re-issue (return) the existing token so token-less sessions survive a reload
  return query select v_row.state, v_row.version, v_row.room_token;
end;
$$;

revoke all on function public.restore_cah(text, text) from public;
grant execute on function public.restore_cah(text, text) to anon;

create or replace function public.dispatch_cah(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.cah_rooms;
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.cah_rooms where public.cah_rooms.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.cah_rooms
     set state = p_new_state, version = public.cah_rooms.version + 1
   where public.cah_rooms.code = p_code
     and public.cah_rooms.version = p_expected_version
  returning public.cah_rooms.state, public.cah_rooms.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_cah(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_cah(text, uuid, jsonb, integer) to anon;

-- ── codenames_rooms ──────────────────────────────────────────────────────────────────

create or replace function public.create_codenames(p_code text, p_state jsonb)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  return query
  insert into public.codenames_rooms (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.codenames_rooms.state, public.codenames_rooms.version, public.codenames_rooms.room_token;
end;
$$;

revoke all on function public.create_codenames(text, jsonb) from public;
grant execute on function public.create_codenames(text, jsonb) to anon;

create or replace function public.join_codenames(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.codenames_rooms;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  select * into v_row from public.codenames_rooms where public.codenames_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_row.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- CR-02: join is only valid in lobby and must add exactly one player without
  -- dropping an existing member, so join cannot overwrite live game state.
  if (v_row.state ->> 'phase') is distinct from 'lobby' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_new_state -> 'players') <> jsonb_array_length(v_row.state -> 'players') + 1 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as old_p
     where not exists (
       select 1 from jsonb_array_elements(p_new_state -> 'players') as new_p
        where new_p ->> 'id' = old_p ->> 'id'
     )
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- CAS: add the joining player by overwriting state at the expected version.
  return query
  update public.codenames_rooms
     set state = p_new_state, version = public.codenames_rooms.version + 1
   where public.codenames_rooms.code = p_code
     and public.codenames_rooms.version = p_expected_version
  returning public.codenames_rooms.state, public.codenames_rooms.version, public.codenames_rooms.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_codenames(text, jsonb, integer) from public;
grant execute on function public.join_codenames(text, jsonb, integer) to anon;

create or replace function public.restore_codenames(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.codenames_rooms;
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.codenames_rooms where public.codenames_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04)
  select exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as p
     where p ->> 'id' = p_player_id
  ) into v_present;
  if not v_present then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- re-issue (return) the existing token so token-less sessions survive a reload
  return query select v_row.state, v_row.version, v_row.room_token;
end;
$$;

revoke all on function public.restore_codenames(text, text) from public;
grant execute on function public.restore_codenames(text, text) to anon;

create or replace function public.dispatch_codenames(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.codenames_rooms;
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.codenames_rooms where public.codenames_rooms.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.codenames_rooms
     set state = p_new_state, version = public.codenames_rooms.version + 1
   where public.codenames_rooms.code = p_code
     and public.codenames_rooms.version = p_expected_version
  returning public.codenames_rooms.state, public.codenames_rooms.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_codenames(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_codenames(text, uuid, jsonb, integer) to anon;

-- ── mindmeld_rooms ──────────────────────────────────────────────────────────────────

create or replace function public.create_mindmeld(p_code text, p_state jsonb)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  return query
  insert into public.mindmeld_rooms (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.mindmeld_rooms.state, public.mindmeld_rooms.version, public.mindmeld_rooms.room_token;
end;
$$;

revoke all on function public.create_mindmeld(text, jsonb) from public;
grant execute on function public.create_mindmeld(text, jsonb) to anon;

create or replace function public.join_mindmeld(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.mindmeld_rooms;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  select * into v_row from public.mindmeld_rooms where public.mindmeld_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if v_row.version <> p_expected_version then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  -- CR-02: join is only valid in lobby and must add exactly one player without
  -- dropping an existing member, so join cannot overwrite live game state.
  if (v_row.state ->> 'phase') is distinct from 'lobby' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if jsonb_array_length(p_new_state -> 'players') <> jsonb_array_length(v_row.state -> 'players') + 1 then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as old_p
     where not exists (
       select 1 from jsonb_array_elements(p_new_state -> 'players') as new_p
        where new_p ->> 'id' = old_p ->> 'id'
     )
  ) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- CAS: add the joining player by overwriting state at the expected version.
  return query
  update public.mindmeld_rooms
     set state = p_new_state, version = public.mindmeld_rooms.version + 1
   where public.mindmeld_rooms.code = p_code
     and public.mindmeld_rooms.version = p_expected_version
  returning public.mindmeld_rooms.state, public.mindmeld_rooms.version, public.mindmeld_rooms.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_mindmeld(text, jsonb, integer) from public;
grant execute on function public.join_mindmeld(text, jsonb, integer) to anon;

create or replace function public.restore_mindmeld(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.mindmeld_rooms;
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.mindmeld_rooms where public.mindmeld_rooms.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04)
  select exists (
    select 1 from jsonb_array_elements(v_row.state -> 'players') as p
     where p ->> 'id' = p_player_id
  ) into v_present;
  if not v_present then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- re-issue (return) the existing token so token-less sessions survive a reload
  return query select v_row.state, v_row.version, v_row.room_token;
end;
$$;

revoke all on function public.restore_mindmeld(text, text) from public;
grant execute on function public.restore_mindmeld(text, text) to anon;

create or replace function public.dispatch_mindmeld(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.mindmeld_rooms;
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.mindmeld_rooms where public.mindmeld_rooms.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
  if jsonb_typeof(p_new_state -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  for v_player in select * from jsonb_array_elements(p_new_state -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.mindmeld_rooms
     set state = p_new_state, version = public.mindmeld_rooms.version + 1
   where public.mindmeld_rooms.code = p_code
     and public.mindmeld_rooms.version = p_expected_version
  returning public.mindmeld_rooms.state, public.mindmeld_rooms.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_mindmeld(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_mindmeld(text, uuid, jsonb, integer) to anon;
