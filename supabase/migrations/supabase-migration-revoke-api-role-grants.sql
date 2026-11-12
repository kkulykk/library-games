-- One-off ops script (applied to the live project 2026-11-04 as
-- `revoke_api_role_grants`). Not run automatically: supabase/schema.sql already
-- embeds this end state for fresh projects.
--
-- Why: Supabase's default privileges grant anon + authenticated ALL on every new
-- public table and EXECUTE on every new public function. The schema only revoked
-- from PUBLIC, so:
--   * anon/authenticated still held SELECT/INSERT/UPDATE/DELETE/TRUNCATE on all
--     room tables. RLS (no policies) blocked DML, but one stray permissive policy
--     or a disabled RLS flag would have re-opened world read/write.
--   * authenticated could execute every game RPC (Security Advisor lint 0029 ×36).
--     The app never signs anyone in, so that role should have nothing.
--   * is_valid_player_name was SECURITY DEFINER and anon-executable although only
--     the definer RPCs call it.
--   * update_updated_at was SECURITY DEFINER for no reason (it touches no tables).
--
-- Dry-run verified (rolled back) on the live project before applying: as anon,
-- create → get → restore → dispatch all succeed; direct table SELECT and the
-- name helper are denied.

do $$
declare
  t text;
  f record;
begin
  foreach t in array array[
    'uno_rooms', 'skribbl_rooms', 'agario_rooms', 'cah_rooms', 'codenames_rooms', 'mindmeld_rooms', 'globetrotter_rooms'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;

  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname ~ '^(create|join|restore|dispatch|get)_'
  loop
    execute format('revoke all on function %s from public, authenticated', f.sig);
  end loop;
end $$;

alter function public.is_valid_player_name(text) security invoker;
revoke all on function public.is_valid_player_name(text) from public, anon, authenticated;

alter function public.update_updated_at() security invoker;
