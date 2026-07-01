-- Migration: SEAL rollback (Phase 3, ACCESS-01) — UNSEAL the room tables
-- Run this in your Supabase project: SQL Editor → New query → Paste → Run
--
-- This is the byte-faithful inverse of supabase-migration-seal-rls.sql: it
-- re-creates the 3 permissive SELECT/UPDATE/INSERT policies on each of the 6
-- room tables, restoring the pre-seal world-readable/writable state. Apply only
-- if a seal verification step fails and you need to roll back.
--
-- RLS is already enabled on every table (the seal never disabled it), so this
-- only re-creates the dropped policies. Each policy uses the table's ORIGINAL
-- name and the original INSERT predicate.

-- ── uno_rooms ────────────────────────────────────────────────────────────────
create policy "select rooms" on public.uno_rooms for select using (true);
create policy "insert with valid code" on public.uno_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );
create policy "update rooms" on public.uno_rooms for update using (true);

-- ── skribbl_rooms ────────────────────────────────────────────────────────────
create policy "select skribbl rooms" on public.skribbl_rooms for select using (true);
create policy "insert skribbl rooms" on public.skribbl_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );
create policy "update skribbl rooms" on public.skribbl_rooms for update using (true);

-- ── agario_rooms ─────────────────────────────────────────────────────────────
create policy "select agario rooms" on public.agario_rooms for select using (true);
create policy "insert agario rooms" on public.agario_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );
create policy "update agario rooms" on public.agario_rooms for update using (true);

-- ── cah_rooms ────────────────────────────────────────────────────────────────
create policy "select cah rooms" on public.cah_rooms for select using (true);
create policy "insert cah rooms" on public.cah_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );
create policy "update cah rooms" on public.cah_rooms for update using (true);

-- ── codenames_rooms ──────────────────────────────────────────────────────────
create policy "select codenames rooms" on public.codenames_rooms for select using (true);
create policy "insert codenames rooms" on public.codenames_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );
create policy "update codenames rooms" on public.codenames_rooms for update using (true);

-- ── mindmeld_rooms ───────────────────────────────────────────────────────────
create policy "select mindmeld rooms" on public.mindmeld_rooms for select using (true);
create policy "insert mindmeld rooms" on public.mindmeld_rooms
  for insert with check (
    code ~ '^[0-9A-HJKMNP-TV-Z]{6}$'
    and state is not null
  );
create policy "update mindmeld rooms" on public.mindmeld_rooms for update using (true);
