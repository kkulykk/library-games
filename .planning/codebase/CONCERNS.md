# Concerns

**Analysis Date:** 2026-06-12

This document records technical debt, risks, and fragile areas. Severity reflects impact on correctness, security, or maintainability — not urgency. This is a hobby game arcade with no real user data, so several "high" security items are low _practical_ risk but worth knowing.

## Security & Trust Model

### Multiplayer is fully client-authoritative

**Severity: High (by design)** · `src/hooks/useGameRoom.ts`, `supabase-schema.sql`

There is no server. The game reducer runs in each player's browser and writes the entire next state directly to Supabase. The database performs no rules validation — any client holding the anon key can `update` a room row with **any** state it wants (cheating, skipping turns, rewriting scores). Zod (`schema.ts`) only checks _shape_, not _legality of the transition_. This is an accepted trade-off for a casual arcade, but it means competitive integrity cannot be assumed.

### Rooms are world-readable and world-writable

**Severity: High (by design)** · `supabase-schema.sql:56,66`

RLS policies are `for select using (true)` and `for update using (true)` on every `*_rooms` table. Consequences:

- **`select using(true)`** — the 4-character room code is _not_ a read secret. Any client can read every active room's full state without knowing its code (rows are enumerable via PostgREST). The schema comments acknowledge RLS "cannot inspect PostgREST query parameters."
- **`update using(true)`** — any authenticated-anon client can overwrite any room, not just one it joined.
- Room codes are 4 hex chars uppercased (`generateRoomCode`, `useGameRoom.ts:40`) → ~65k space. Trivially brute-forceable; collisions are also possible on create with no retry-on-conflict.

DELETE is correctly denied (no policy); cleanup is via `pg_cron` only.

### Anon key + URL is the entire auth story

**Severity: Medium** · `src/lib/supabase.ts`

`playerId` is a client-generated UUID stored in `localStorage`; there is no identity verification. Anyone can claim to be any `playerId` by writing it into a state payload. Invite codes travel in the URL hash (`useInviteCode.ts`).

## Correctness & Concurrency

### Optimistic CAS gives up after 3 retries

**Severity: Medium** · `src/hooks/useGameRoom.ts:379` (`dispatch`)

Writes use compare-and-swap on `version`. Under contention a losing writer re-reads and retries up to `MAX_RETRIES = 3`, then surfaces "Action failed due to a conflict." In a busy room (e.g. real-time games like agario) an action can be silently dropped or rejected. There's no queue — the user must re-trigger. Acceptable for turn-based games, riskier for the realtime ones.

### Realtime echo vs. optimistic local apply

**Severity: Low** · `useGameRoom.ts:400-405`

`dispatch` applies the accepted state locally immediately and also receives it again via the postgres_changes echo. Logic is idempotent so this is fine today, but any future non-idempotent side effect in the render path tied to state identity could double-fire.

### Invalid payloads are dropped silently (to the user)

**Severity: Low** · `useGameRoom.ts:182,198,280,353,414`

Failed `safeParse` results are `console.error`'d and the update is ignored. A schema/version mismatch between two clients (e.g. one player on an old deploy) manifests as a frozen game with no user-visible explanation.

## Type Safety

### `as unknown as` casts at the Supabase boundary

**Severity: Low** · `src/lib/supabase.ts:37,39`, `useGameRoom.ts:141`

The Supabase client and the fake client are both force-cast to a hand-written `SupabaseBoundary` interface. Presence state is read via `(p as unknown as { player_id: string })`. These bypass the compiler — a drift between the real Supabase API shape and `SupabaseBoundary` would not be caught at build time.

## Testing Gaps

### Schema tests missing for two games

**Severity: Low** · `src/games/codenames/`, `src/games/mindmeld/`

Both have a `schema.ts` but no `schema.test.ts`, unlike `uno`, `skribbl`, `agario`, `cards-against-humanity`. Their network-payload contracts are only exercised indirectly via E2E.

### Coverage gate covers logic only

**Severity: Low** · `jest.config.js:16`

`collectCoverageFrom: ['src/games/**/logic.ts']`. The ≥80% gate never sees `useGameRoom.ts` (the most complex and security-relevant file), the `*Game.tsx` renderers, or `src/components/`. Regressions there rely entirely on RTL component tests + Playwright catching them.

### E2E must run serially

**Severity: Low** · `playwright.config.ts:12`, `e2e/fake-supabase/server.mjs`

The fake Supabase server holds a single shared state and resets before each test, forcing `workers: 1`. As the game count grows the E2E suite wall-clock time will scale linearly with no parallelism relief.

## Documentation Drift

**Severity: Medium** · `CLAUDE.md`, project memory

The repo has outrun its own docs. Worth reconciling before they mislead future work:

| Claim in docs                     | Actual state                                              |
| --------------------------------- | --------------------------------------------------------- |
| Next.js 15                        | `next@^16.2.6` (package.json)                             |
| Tailwind CSS 3                    | `tailwindcss@^4.3.0` + `@tailwindcss/postcss`             |
| Jest 29                           | `jest@^30.4.2`                                            |
| 11 games (8 live + 3 coming-soon) | 17 game folders present                                   |
| No E2E mentioned                  | Full Playwright suite under `e2e/`                        |
| Single CI workflow, no e2e step   | verify `.github/workflows/ci.yml` against current scripts |

`CLAUDE.md`'s "Adding a game" checklist also predates the multiplayer pattern (no `schema.ts` / `use<Name>Room.ts` step for online games, though the Supabase section does cover it separately).

## Operational

### Room cleanup depends on pg_cron being configured

**Severity: Low** · `supabase-schema.sql`

24h auto-delete is delivered by a `pg_cron` job that must be scheduled manually in the Supabase project. If not set up, rooms accumulate indefinitely. The DELETE-by-cron is the _only_ delete path (no policy allows client deletes).

### Build hard-depends on Supabase secrets in CI

**Severity: Low** · CI config

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` must exist as GitHub Actions secrets. Absent them, multiplayer silently degrades — `supabase` resolves to `null` (`src/lib/supabase.ts:36`) and online games no-op without a loud failure.

## Summary

| Area        | Highest severity | Note                                                                  |
| ----------- | ---------------- | --------------------------------------------------------------------- |
| Trust model | High (by design) | No server auth; world-writable rooms — fine for a toy, not for stakes |
| Concurrency | Medium           | 3-retry CAS can drop actions in busy realtime games                   |
| Type safety | Low              | `as unknown as` casts at the Supabase seam                            |
| Testing     | Low              | logic-only coverage; 2 missing schema tests; serial E2E               |
| Doc drift   | Medium           | Next/Tailwind/Jest versions + game count stale in CLAUDE.md & memory  |
