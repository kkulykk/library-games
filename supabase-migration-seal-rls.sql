-- Migration: SEAL the room tables (Phase 3, ACCESS-01)
-- Run this in your Supabase project: SQL Editor → New query → Paste → Run
--
-- What this does:
--   Drops the permissive SELECT/UPDATE/INSERT `using(true)` policies on all 6
--   room tables, closing the world-readable enumeration vector and the
--   world-write surface. RLS is left ENABLED (default-deny for anon).
--
-- Why this is needed on EXISTING deployments:
--   PostgreSQL keeps policies until an explicit DROP. Re-running supabase-schema.sql
--   (which no longer CREATEs these policies) does NOT remove already-installed
--   policies. Apply this migration once to seal a project that ran an earlier schema.
--   (supabase-schema.sql now also embeds this same drop block for fresh paste-and-run.)
--
-- Safe to run repeatedly: `drop policy if exists` is idempotent, and on a fresh
-- project (no permissive policies) this is a no-op.
--
-- After Phase 2, every create/join/restore/dispatch and every read runs through
-- SECURITY DEFINER RPCs that bypass RLS as the table owner, so dropping these
-- policies does NOT break legitimate play.
--
-- CRITICAL: this migration ONLY drops policies. It must NEVER turn RLS off —
-- doing so would re-open world-read. RLS stays enabled throughout. DELETE has no
-- policy (pg_cron-only cleanup) and is left untouched.
--
-- Rollback: supabase-migration-seal-rls-rollback.sql re-creates all 18 policies.
--
-- This migration is name-agnostic: per-table policy names diverge (uno uses
-- "select rooms" / "insert with valid code" / "update rooms"; the other five use
-- "select <game> rooms" / "insert <game> rooms" / "update <game> rooms"), so we
-- iterate pg_policies and drop by discovered name rather than hard-coding names.

do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'uno_rooms', 'skribbl_rooms', 'agario_rooms',
    'cah_rooms', 'codenames_rooms', 'mindmeld_rooms'
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
end $$;

-- RLS stays ENABLED (default-deny for anon). DELETE has no policy (pg_cron-only) → untouched.
