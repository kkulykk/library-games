# Repo Audit Checklist — 2026-06-12

Action items from a full audit of consistency, security, and finished-ness.
Quality gates at audit time: `pnpm lint`, `pnpm test`, and `pnpm build` all pass.

## 🔴 High priority

- [ ] **Widen room code space and handle collisions.** `generateRoomCode()` in
      `src/hooks/useGameRoom.ts` takes the first 4 chars of a UUID, so codes are
      hex-only — 16⁴ = 65,536 combinations instead of the 36⁴ = 1.6M the RLS
      regex (`^[A-Z0-9]{4}$`) implies. With `SELECT using (true)`, all active
      rooms are enumerable, and birthday collisions get likely at ~250
      concurrent rooms. Sample the full `A-Z0-9` alphabet (ideally 6 chars,
      updating the RLS policies to match) and retry `createRoom` on
      unique-constraint collisions instead of failing with a dead-end error.
- [ ] **Make room cleanup real.** CLAUDE.md claims rooms auto-delete after 24h
      via a pg_cron job at `0 * * * *`, but `supabase-schema.sql` only has
      commented-out `delete from …` statements and DELETE is denied by RLS, so
      rooms (including player names) accumulate forever in all six tables.
      Add a real `cron.schedule(...)` to the schema and apply it to the live
      project — or correct the docs and accept unbounded growth deliberately.
- [ ] **Gate the `@claude` workflow trigger.** `.github/workflows/claude.yml`
      fires on any comment containing `@claude` — on a public repo that is any
      GitHub user. Add an author-association check to the job `if:`, e.g.
      `contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`.

## 🟡 Medium priority

- [ ] **Rewrite CLAUDE.md against the current codebase.** It says Next.js 15 /
      Tailwind 3 (actual: Next 16 / Tailwind 4), references the deleted
      `src/components/GameCard.tsx` (home UI lives in `src/components/home/`),
      describes CI as 3 jobs (the `e2e` job is missing), omits the `pnpm e2e*`
      scripts, and still documents the old per-game room-hook pattern instead
      of the shared `src/hooks/useGameRoom.ts`. README.md is accurate and can
      serve as the reference.
- [ ] **Align skribbl's page with the other games.**
      `src/app/games/skribbl/page.tsx` wraps the game in a bare
      `ErrorBoundary` instead of `GameLayout`, silently losing the rules gate
      and the standard back-button chrome.
- [ ] **Add `schema.test.ts` for codenames and mindmeld.** Uno, skribbl,
      agario, and CAH all test their Zod schemas; the two newest games don't,
      and the schema is the trust boundary against malicious room state.
- [ ] **Pin the package manager.** `package.json` has no `packageManager`
      field; CI hardcodes pnpm 9 while the lockfile was produced by pnpm 10.
      Add `"packageManager": "pnpm@10.x.y"` and drop the hardcoded `version:`
      from `pnpm/action-setup` so it reads from package.json.
- [ ] **Consolidate the SQL story.** `supabase-migration-secure-rls.sql`
      duplicates uno-only policy logic that also lives in
      `supabase-schema.sql`, and the "add version column" migration comment at
      the bottom of the schema is stale (missing `codenames_rooms` and
      `mindmeld_rooms`). Move to a `supabase/migrations/` directory with one
      numbered file per change and delete the one-off file once applied.

## 🟢 Low priority / polish

- [ ] **Skip the Pages build on PRs.** CI builds and uploads a Pages artifact
      on every PR even though deploy only runs on `main` pushes (CLAUDE.md even
      says build is main-only). Gate the `build` job on
      `github.ref == 'refs/heads/main' && github.event_name == 'push'`.
- [ ] **Pick one CSS convention.** Uno and skribbl use CSS Modules
      (`UnoGame.module.css`, `SkribblGame.module.css`,
      `ArcadeShell.module.css`); the other 14 games are pure Tailwind. Decide
      the convention for future games and note it in CLAUDE.md.
- [ ] **Small code cleanups.** Remove unused `supabase` imports in
      `useCAHRoom.ts` and `useMindmeldRoom.ts`; justify or fix the
      `eslint-disable react-hooks/exhaustive-deps` in `AgarioGame.tsx`.
- [ ] **Decide on the fabricated catalog stats.** `src/data/games.ts` ships
      hardcoded `rating` (e.g. 4.8) and `plays` (e.g. "6.9M") values that look
      like real telemetry but aren't. Fine if intentional set-dressing —
      otherwise remove or label them.
- [ ] **Resolve Chess.** It is the lone `coming-soon` entry in `games.ts` —
      build it or drop it.
- [ ] **Add a custom `not-found.tsx`.** GitHub Pages visitors hitting a bad
      path currently get the default Next 404.
- [ ] **Cap room state size in RLS (hardening).** The insert/update policies
      don't limit `state`, so a hostile client could write multi-MB jsonb
      blobs. A `pg_column_size(state) < 262144`-style check would bound that.

## ✅ Checked and clean

- No secrets in git history; `.gitignore` covers `.env*`; only
  `NEXT_PUBLIC_*` keys in client code.
- No `dangerouslySetInnerHTML` / `innerHTML`; player names render through
  React escaping or canvas `fillText`.
- `useGameRoom.ts` validates every state ingress with Zod and uses
  version-based optimistic concurrency with retry.
- The e2e fake-Supabase client is gated behind a build-time flag and cannot
  activate in the static production export.
- Table names match between hooks and `supabase-schema.sql`; all 11
  single-player games have `logic.ts` + `logic.test.ts`; `games.ts` and the
  route directories are perfectly aligned.
