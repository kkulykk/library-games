#!/usr/bin/env node
// Generates supabase/schema.sql from a single template (P2-2).
//
// The four write RPCs + the read RPC + the table/trigger boilerplate are
// identical across every game table modulo the table name. Hand-maintaining six
// near-identical ~200-line blocks is how a per-table auth bug (or a missed
// hardening fix like the P0-1 size caps) slips in unnoticed. This script renders
// every per-game block from one template so a change is made once and applied
// uniformly.
//
// Usage:
//   node scripts/generate-schema.mjs           # write supabase/schema.sql
//   node scripts/generate-schema.mjs --check   # exit 1 if the file is stale
//
// CI runs the --check mode so the committed SQL can never drift from this
// template. When adding a game, extend GAMES below and re-run.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'supabase', 'schema.sql')

// ─── Resource-abuse guards (P0-1) ────────────────────────────────────────────
// Every write RPC accepts an arbitrary jsonb state from a holder of the public
// anon key. Without caps, a scripted client can balloon storage/egress with
// multi-megabyte states or huge rosters before the 24h cleanup runs.
const MAX_STATE_BYTES = 262144 // 256 KiB — comfortably above the largest legit state (agario)
const MAX_ROSTER = 16 // above every game's client-enforced max player count

// Order matters: this is the order the blocks appear in schema.sql.
const GAMES = [
  { table: 'uno_rooms', title: 'Uno' },
  { table: 'skribbl_rooms', title: 'Skribbl' },
  { table: 'agario_rooms', title: 'Agar.io' },
  { table: 'cah_rooms', title: 'Cards Against Humanity' },
  { table: 'codenames_rooms', title: 'Codenames' },
  { table: 'mindmeld_rooms', title: 'Mindmeld' },
]

const game = (table) => table.replace('_rooms', '')

// ─── Fragments shared by the write RPCs ──────────────────────────────────────

// Validate every player name in a candidate state (INPUT-01, helper).
const validateNames = (stateParam) => `  if jsonb_typeof(${stateParam} -> 'players') <> 'array' then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if jsonb_array_length(${stateParam} -> 'players') > ${MAX_ROSTER} then
    raise exception 'too many players' using errcode = '22023';  -- P0-1 roster cap
  end if;
  for v_player in select * from jsonb_array_elements(${stateParam} -> 'players') loop
    if not public.is_valid_player_name(v_player ->> 'name') then
      raise exception 'invalid name' using errcode = '22023';
    end if;
  end loop;`

// P0-1 payload-size guard, checked before anything else touches the jsonb.
const sizeGuard = (stateParam) => `  if pg_column_size(${stateParam}) > ${MAX_STATE_BYTES} then
    raise exception 'state too large' using errcode = '22023';  -- P0-1 payload cap
  end if;`

// ─── Per-section renderers ───────────────────────────────────────────────────

function header() {
  return `-- Run this in your Supabase project: SQL Editor → New query → Paste → Run
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ GENERATED FILE — do not edit by hand.                                      │
-- │ Source of truth: scripts/generate-schema.mjs. Regenerate with             │
-- │   pnpm generate:schema   (CI enforces freshness via pnpm check:schema).   │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Security model (unchanged by the generator):
--   * RLS is ENABLED on every room table with NO permissive policies, so anon
--     is default-deny for direct table access. All legitimate access flows
--     through the SECURITY DEFINER RPCs below (create/join/restore/dispatch/get),
--     which run as the table owner and bypass RLS. The SEAL block drops any
--     pre-existing permissive using(true) policies so re-pasting this file onto
--     an older deployment actually seals it. DELETE has no policy (pg_cron-only
--     cleanup); the write RPCs also opportunistically prune rooms older than 24h.
--   * The room code is the read/write capability. The per-room room_token is
--     defense-in-depth for the write path, NOT per-player authentication — see
--     README.md "Security model & trust boundaries".`
}

function sharedTriggerFunctions() {
  return `-- ─── Shared trigger functions ────────────────────────────────────────────────

-- Keep updated_at fresh on every update.
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
$$;`
}

function tableBlock({ table, title }) {
  return `-- ─── ${title} rooms table ─────────────────────────────────────────────────────

create table if not exists ${table} (
  id         uuid        default gen_random_uuid() primary key,
  code       text        unique not null,
  state      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz default now()
);

create or replace trigger ${table}_updated_at
  before update on ${table}
  for each row execute function update_updated_at();

create or replace trigger ${table}_protect_immutable
  before update on ${table}
  for each row execute function protect_immutable_columns();

alter publication supabase_realtime add table ${table};

-- SEALED (Phase 3, ACCESS-01): RLS enabled, no permissive policies (default-deny
-- for anon). Access flows through the SECURITY DEFINER RPCs only.
alter table ${table} enable row level security;

-- delete from ${table} where updated_at < now() - interval '24 hours';`
}

function sealBlock() {
  const list = GAMES.map((g) => `'${g.table}'`).join(', ')
  return `-- ─── SEAL: drop any pre-existing permissive policies (Phase 3, ACCESS-01) ─────
-- On a FRESH project this is a no-op (no policies were ever created). On an
-- EXISTING project that ran an earlier version of this schema, the old
-- permissive SELECT/UPDATE/INSERT \`using(true)\` policies SURVIVE a re-paste —
-- PostgreSQL keeps policies until an explicit DROP — which would leave anon
-- direct table access open and defeat the seal. This block drops them
-- name-agnostically (policy names diverge across tables), so pasting this file
-- actually seals an existing deployment. RLS stays ENABLED throughout (never
-- disabled — that would re-open world-read). DELETE has no policy (pg_cron-only
-- cleanup) and is left untouched.
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    ${list}
  ] loop
    for pol in
      select policyname from pg_policies
       where schemaname = 'public'
         and tablename = t
         and cmd in ('SELECT', 'UPDATE', 'INSERT')
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;`
}

function roomTokenColumns() {
  const alters = GAMES.map(
    (g) =>
      `alter table public.${g.table} add column if not exists room_token uuid not null default gen_random_uuid();`
  ).join('\n')
  return `-- ─── room_token column (×${GAMES.length}) ─────────────────────────────────────────────────
-- The per-room write capability (D-01). UUID v4 = ~122 bits CSPRNG, server-
-- minted, never in the invite URL. This is a room-scoped write token, NOT
-- per-player auth (any member shares it; see README trust-boundaries section).

${alters}`
}

function broadcastFunctionAndTriggers() {
  const triggers = GAMES.map(
    (g) =>
      `create or replace trigger ${g.table}_broadcast_state after update on public.${g.table}
  for each row execute function public.broadcast_room_state();`
  ).join('\n\n')
  return `-- ─── Shared broadcast trigger function ───────────────────────────────────────
-- Emits the full {state, version} on the PUBLIC topic \`room:CODE\` after every
-- state UPDATE (ACCESS-05, D-09 full payload, D-11 secret-topic model). The 4th
-- arg to realtime.send MUST be \`false\` → PUBLIC channel that any anon client may
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

-- ─── Per-table broadcast triggers (×${GAMES.length}) ───────────────────────────────────────

${triggers}`
}

function nameHelper() {
  return `-- ─── Server-side player-name validation helper (INPUT-01, D-05) ──────────────
-- A name is valid iff, after trim, its length is 1..20 AND it contains no
-- character in Unicode categories Cc (control), Cf (format), Zl (line
-- separator) or Zp (paragraph separator). Everything else — unicode letters,
-- digits, punctuation, emoji — is allowed (the real risks for a casual arcade
-- are length-DoS and blank/invisible names; React escapes rendered output).
-- Client Zod is a SUBSET of this accept-set (INPUT-03: client ⊆ Postgres).
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
  -- regex matches the actual characters; \\u escapes are not portable here):
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
grant execute on function public.is_valid_player_name(text) to anon;`
}

function rpcHeaderComment() {
  return `-- ─── Member-scoped SECURITY DEFINER RPCs (×${GAMES.length} games) ──────────────────────────
-- Four RPCs per game (create / join / restore / dispatch). Every function:
--   * security definer + set search_path = '' + fully-qualified public. names
--     (ACCESS-04, clears Security Advisor lint 0011)
--   * revoke all from public; grant execute to anon only (scoped EXECUTE)
--   * re-checks the canonical 6-char Crockford code server-side (INPUT-02)
--   * validates every player name in the candidate state (INPUT-01, helper)
--   * caps payload size and roster size (P0-1) on the create/join/dispatch
--     write paths (each accepts an arbitrary anon-supplied jsonb state)
-- Errcodes (mapped to friendly UI strings by the hook — no raw DB errors):
--   22023 invalid code / invalid name / oversized state / too many players
--   42501 unauthorized (token / not member) | 40001 version conflict (CAS)
-- The reducer stays client-side; dispatch takes p_new_state + p_expected_version
-- and does the CAS. All writes require code + room_token (D-02/D-03). join issues
-- the token; restore re-issues it iff p_player_id ∈ state.players (D-04).`
}

function createRpc({ table }) {
  const g = game(table)
  return `create or replace function public.create_${g}(p_code text, p_state jsonb)
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
${sizeGuard('p_state')}
${validateNames('p_state')}
  -- P2-6: opportunistic, bounded cleanup so orphaned rooms decay even if the
  -- pg_cron job was never scheduled. Cheap on the create path.
  delete from public.${table}
   where ctid in (
     select ctid from public.${table}
      where updated_at < now() - interval '24 hours'
      limit 100
   );
  return query
  insert into public.${table} (code, state, room_token)
  values (p_code, p_state, gen_random_uuid())
  returning public.${table}.state, public.${table}.version, public.${table}.room_token;
end;
$$;

revoke all on function public.create_${g}(text, jsonb) from public;
grant execute on function public.create_${g}(text, jsonb) to anon;`
}

function joinRpc({ table }) {
  const g = game(table)
  return `create or replace function public.join_${g}(p_code text, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player jsonb;
  v_row public.${table};
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
${sizeGuard('p_new_state')}
${validateNames('p_new_state')}
  select * into v_row from public.${table} where public.${table}.code = p_code;
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
  update public.${table}
     set state = p_new_state, version = public.${table}.version + 1
   where public.${table}.code = p_code
     and public.${table}.version = p_expected_version
  returning public.${table}.state, public.${table}.version, public.${table}.room_token;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.join_${g}(text, jsonb, integer) from public;
grant execute on function public.join_${g}(text, jsonb, integer) to anon;`
}

function restoreRpc({ table }) {
  const g = game(table)
  return `create or replace function public.restore_${g}(p_code text, p_player_id text)
returns table(state jsonb, version integer, room_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.${table};
  v_present boolean;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.${table} where public.${table}.code = p_code;
  if not found then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- verify p_player_id ∈ state.players (jsonb membership) (D-04). NOTE: player
  -- ids are readable via get_${g}, so this is not per-player auth — see README.
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

revoke all on function public.restore_${g}(text, text) from public;
grant execute on function public.restore_${g}(text, text) to anon;`
}

function dispatchRpc({ table }) {
  const g = game(table)
  return `create or replace function public.dispatch_${g}(p_code text, p_room_token uuid, p_new_state jsonb, p_expected_version integer)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.${table};
  v_player jsonb;
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  select * into v_row from public.${table} where public.${table}.code = p_code;
  if not found or v_row.room_token <> p_room_token then
    raise exception 'unauthorized' using errcode = '42501';   -- token gate (ACCESS-03)
  end if;
${sizeGuard('p_new_state')}
  -- INPUT-01: validate every player name server-side on the steady-state write
  -- path too (CR-04), consistent with create/join — dispatch is a trust boundary.
${validateNames('p_new_state')}
  -- CAS (optimistic concurrency); 40001 on conflict → client re-reads + retries
  return query
  update public.${table}
     set state = p_new_state, version = public.${table}.version + 1
   where public.${table}.code = p_code
     and public.${table}.version = p_expected_version
  returning public.${table}.state, public.${table}.version;
  if not found then
    raise exception 'version conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.dispatch_${g}(text, uuid, jsonb, integer) from public;
grant execute on function public.dispatch_${g}(text, uuid, jsonb, integer) to anon;`
}

function getRpc({ table }) {
  const g = game(table)
  return `create or replace function public.get_${g}(p_code text)
returns table(state jsonb, version integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code !~ '^[0-9A-HJKMNP-TV-Z]{6}$' then
    raise exception 'invalid code' using errcode = '22023';
  end if;
  return query
  select public.${table}.state, public.${table}.version
    from public.${table}
   where public.${table}.code = p_code;
  -- NO \`if not found\` raise: unknown code → zero rows (preserves "Room not found" UX).
end;
$$;

revoke all on function public.get_${g}(text) from public;
grant execute on function public.get_${g}(text) to anon;`
}

function getRpcHeader() {
  return `-- ─── Code-gated read RPCs (ACCESS-01) ─────────────────────────────────────────
-- get_<game>(p_code) is the sealed-world read primitive. It requires the EXACT
-- room code and returns at most one room's { state, version } — there is no list
-- capability and no wildcard, so it is NOT a re-opening of the world-readable
-- \`select using(true)\` path. An unknown code returns ZERO rows (NOT a raised
-- error), preserving the "Room not found" UX (D-01). NOTE: the full state row —
-- including any hidden info (hands, keys, secret words) — is readable by any
-- code-holder. Competitive integrity is honor-system; see README.`
}

function build() {
  const parts = []
  parts.push(header())
  parts.push(sharedTriggerFunctions())
  for (const g of GAMES) parts.push(tableBlock(g))
  parts.push(sealBlock())
  parts.push(roomTokenColumns())
  parts.push(broadcastFunctionAndTriggers())
  parts.push(nameHelper())
  parts.push(rpcHeaderComment())
  for (const g of GAMES) {
    parts.push(`-- ── ${g.table} ──`)
    parts.push(createRpc(g))
    parts.push(joinRpc(g))
    parts.push(restoreRpc(g))
    parts.push(dispatchRpc(g))
  }
  parts.push(getRpcHeader())
  for (const g of GAMES) parts.push(getRpc(g))
  return parts.join('\n\n') + '\n'
}

const generated = build()
const check = process.argv.includes('--check')

if (check) {
  let current = ''
  try {
    current = readFileSync(OUT_PATH, 'utf8')
  } catch {
    console.error(`schema check: ${OUT_PATH} is missing. Run: pnpm generate:schema`)
    process.exit(1)
  }
  if (current !== generated) {
    console.error(
      'schema check: supabase/schema.sql is out of date with scripts/generate-schema.mjs.\n' +
        'Run: pnpm generate:schema'
    )
    process.exit(1)
  }
  console.log('schema check: supabase/schema.sql is up to date.')
} else {
  writeFileSync(OUT_PATH, generated)
  console.log(`Wrote ${OUT_PATH}`)
}
