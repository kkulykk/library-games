-- Migration: revoke EXECUTE on internal trigger functions (advisor cleanup)
-- Run this in your Supabase project: SQL Editor → New query → Paste → Run
--
-- What this does:
--   Trigger / event-trigger functions are fired by Postgres internally and must
--   NOT be callable via PostgREST RPC. Functions default to PUBLIC EXECUTE, which
--   exposed them at /rest/v1/rpc as anon/authenticated SECURITY DEFINER endpoints
--   (Supabase advisor: anon_security_definer_function_executable). This revokes
--   that EXECUTE. Triggers still fire normally — a trigger runs as the table
--   owner regardless of role-level EXECUTE grants.
--
-- Safe to run repeatedly and on any project: each function is only revoked if it
-- exists (to_regprocedure returns NULL otherwise). rls_auto_enable is a
-- Supabase-managed event trigger and may not exist in every project.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.broadcast_room_state()',
    'public.update_updated_at()',
    'public.protect_immutable_columns()',
    'public.rls_auto_enable()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;
