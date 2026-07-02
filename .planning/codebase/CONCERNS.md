# Concerns

**Analysis Date:** 2026-06-12

> **⚠️ The "Security & Trust Model" section below is SUPERSEDED and retained only
> for history.** It predates the Phase 1–4 hardening and the 2026-07-02 review.
> For the current security posture see
> [`docs/reviews/2026-07-02-security-architecture-review.md`](../../docs/reviews/2026-07-02-security-architecture-review.md)
> and the "Security model & trust boundaries" section in `README.md`. Several
> claims below are now **false** (room codes are 6-char CSPRNG not 4-hex; RLS is
> sealed with no permissive policies, not `using(true)`; access is via
> `SECURITY DEFINER` RPCs with server-side validation and payload/roster caps).

This document records technical debt, risks, and fragile areas. Severity reflects impact on correctness, security, or maintainability — not urgency. This is a hobby game arcade with no real user data, so several "high" security items are low _practical_ risk but worth knowing.

## Security & Trust Model _(SUPERSEDED — see banner above)_

### Multiplayer is fully client-authoritative

**Severity: High (by design)** · `src/hooks/useGameRoom.ts`, `supabase/schema.sql`

Still accurate. There is no server; the reducer runs in each browser and writes the next state to Supabase. Zod checks _shape_, not transition _legality_. Note (since this was written): the write RPCs now enforce code format, player-name validity, and payload/roster **size caps** server-side — so the "any state it wants" claim is bounded (a member can still write any _legal-shaped, capped_ state). Competitive integrity remains honor-system.

### ~~Rooms are world-readable and world-writable~~ (RESOLVED)

**Status: Fixed.** RLS is now sealed: enabled with **no** permissive policies (default-deny for anon). There are no `using(true)` SELECT/UPDATE/INSERT policies — the SEAL block in `supabase/schema.sql` drops any legacy ones. All access flows through `SECURITY DEFINER` RPCs. Room codes are **6-char Crockford base32 from a CSPRNG** (no modulo bias), read via a single-row code-gated `get_<game>` RPC (no enumeration). The original 4-hex / world-writable description no longer applies.

### Anon key + URL is the entire auth story

**Severity: Medium (by design)** · `src/lib/supabase.ts`

Partly still true and now precisely characterized in the 2026-07-02 review (P1-2): a per-room `room_token` hardens the write path but is **not** per-player auth. Because player ids are readable via `get_<game>`, a code-holder can `restore` as any player and receive the shared token — the room code is effectively the full write capability. `playerId` is a client-generated id in `localStorage`; invite codes travel in the URL hash (`useInviteCode.ts`), which is not sent to servers/logs.

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

### ~~Schema tests missing for two games~~ (RESOLVED)

**Status: Fixed.** `src/games/codenames/schema.test.ts` and `src/games/mindmeld/schema.test.ts` now exist alongside the other four.

### Coverage gate covers logic only _(partially addressed)_

**Severity: Low** · `jest.config.js`

The 2026-07-02 review (P2-3) extended `collectCoverageFrom` to include `src/games/**/schema.ts`, `src/lib/**/*.ts`, and `src/hooks/**/*.ts` (with realistic per-path floors for the hook and lib helpers). The `*Game.tsx` renderers and `src/components/` are still outside the gate.

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

## Maintainability

### Oversized, undecomposed game components

**Severity: Medium** · `src/games/*/*Game.tsx`

Four `'use client'` components carry the bulk of their game's UI, input, animation, and view logic in a single file:

- `src/games/skribbl/SkribblGame.tsx` — 1,586 lines
- `src/games/agario/AgarioGame.tsx` — 1,567 lines
- `src/games/uno/UnoGame.tsx` — 1,426 lines
- `src/games/cards-against-humanity/CardsAgainstHumanityGame.tsx` — 1,120 lines

The pure-logic split keeps `logic.ts` clean, but the _render_ side has not been decomposed. These files concentrate change risk, are hard to review, and sit outside the coverage gate (logic-only). Candidates for extracting subcomponents/hooks.

### Large static data bundled into the client

**Severity: Low** · `src/games/cards-against-humanity/cards.ts`

The CAH deck is a 2,136-line module imported directly, so the full deck ships in the JS bundle for that route with no lazy-loading. Minor for a static site, but it grows the per-game payload.

### ~~Realtime channels only clean up on React unmount~~ (RESOLVED)

**Status: Fixed.** `useGameRoom` now tears channels down on `visibilitychange→hidden` and on `pagehide` (the latter corrected to listen on `window` in the 2026-07-02 review, P2-1), and re-subscribes on `visibilitychange→visible`.

## Operational

### Room cleanup depends on pg_cron being configured

**Severity: Low** · `supabase/schema.sql`

24h auto-delete is delivered by a `pg_cron` job that must be scheduled manually in the Supabase project. If not set up, rooms accumulate indefinitely. The DELETE-by-cron is the _only_ delete path (no policy allows client deletes).

### Build hard-depends on Supabase secrets in CI

**Severity: Low** · CI config

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` must exist as GitHub Actions secrets. Absent them, multiplayer silently degrades — `supabase` resolves to `null` (`src/lib/supabase.ts:36`) and online games no-op without a loud failure.

## Summary

| Area            | Highest severity | Note                                                                  |
| --------------- | ---------------- | --------------------------------------------------------------------- |
| Trust model     | High (by design) | No server auth; world-writable rooms — fine for a toy, not for stakes |
| Concurrency     | Medium           | 3-retry CAS can drop actions in busy realtime games                   |
| Type safety     | Low              | `as unknown as` casts at the Supabase seam                            |
| Testing         | Low              | logic-only coverage; 2 missing schema tests; serial E2E               |
| Maintainability | Medium           | 4 game components 1.1k–1.6k LOC, undecomposed and uncovered           |
| Doc drift       | Medium           | Next/Tailwind/Jest versions + game count stale in CLAUDE.md & memory  |
