# Security, Architecture & SSDLC Review — 2026-07-02

Full-repo review covering security posture, architecture, SSDLC/CI, dependencies, code quality,
testing, and pattern usage. Supersedes the security sections of
`.planning/codebase/CONCERNS.md` (dated 2026-06-12), which predates the Phase 1–4 hardening and
is now stale in several places (room-code entropy, RLS sealing, tab-close teardown, schema tests
all landed since).

## What is already strong

Credit where due — the recent hardening rounds put this repo in unusually good shape for a
serverless hobby arcade:

- **Sealed data layer.** RLS enabled with zero permissive policies; all access flows through
  `SECURITY DEFINER` RPCs with `set search_path = ''`, scoped `grant execute to anon`, stable
  errcodes, and a name-agnostic seal block that drops legacy policies on re-paste.
- **Capability model.** 6-char Crockford room codes from a CSPRNG (no modulo bias), invite codes
  in the URL fragment (not sent to servers/logs), per-room `room_token` minted server-side for
  writes, code-gated single-row read RPC (no enumeration).
- **Untrusted-data discipline.** Every payload crossing the network (state rows, broadcasts,
  presence rows, localStorage sessions) is Zod-`safeParse`d or shape-guarded before entering
  React state; forged public-topic broadcasts are treated as wake-up signals only, with an
  authoritative re-read under a strictly-monotonic version guard.
- **Concurrency.** Integer-version CAS with bounded retries on dispatch/join/create, server-side
  join invariants (lobby-only, exactly +1 player, no member removal).
- **Engineering hygiene.** Pure `logic.ts` state machines with an 80% coverage gate, shared
  `useGameRoom` engine (no per-game lifecycle re-implementation), page-object Playwright suite
  with a fake Supabase, visual-regression + axe accessibility specs, Dependabot (npm + actions),
  husky + lint-staged, ESLint 9 flat config + Prettier enforced in CI.
- No `dangerouslySetInnerHTML`, no `eval`, no third-party runtime scripts; fonts self-hosted via
  `next/font`.

The findings below are ranked by practical priority for this project's threat model (public
anon-key client-authoritative arcade, no PII beyond self-chosen display names).

---

## P0 — Fix soon (cheap, real exposure)

### P0-1: No payload-size or roster-size caps on the write RPCs (resource-abuse DoS)

`create_*` and `dispatch_*`/`join_*` accept an arbitrary `jsonb` state. Anyone with the public
anon key (it ships in the JS bundle) can script `create_<game>` in a loop with multi-megabyte
states, or a room member can dispatch a huge state. Rooms live up to 24 h before `pg_cron`
cleanup, so this is a cheap way to balloon storage/egress on the Supabase project.

**Action:** in every `create_/join_/dispatch_` RPC add a guard such as
`if pg_column_size(p_new_state) > 262144 then raise exception ... errcode '22023'` (pick a bound
comfortably above the largest legitimate state — agario is the biggest) and cap
`jsonb_array_length(state->'players')` (e.g. ≤ 16). Client `addPlayer` already enforces max
players, but only server-side checks count.

### P0-2: `claude.yml` triggers on `@claude` from any GitHub user

The workflow fires on issues/comments containing `@claude` with no author gating. Any drive-by
account can open an issue and burn your Claude OAuth token quota, and the issue body becomes the
prompt (prompt-injection surface). Permissions are read-only, which limits blast radius, but the
trigger itself is open.

**Action:** add an author-association guard to the job `if:`, e.g.
`contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`
(and the equivalent for issues/reviews).

### P0-3: CI runs on Node 20 (EOL April 2026) and pnpm 9 while the repo uses pnpm 10

`ci.yml` pins `node-version: '20'` — past end-of-life as of this review — and `pnpm/action-setup`
pins major 9 while local development runs pnpm 10.x. `package.json` has no `packageManager`
field, so nothing arbitrates. Same-lockfile-different-resolver drift is a classic
works-locally-fails-in-CI (or vice versa) source, and EOL Node stops receiving security patches.

**Action:** add `"packageManager": "pnpm@10.x.y"` to `package.json`, drop the hardcoded
`version: 9` from `pnpm/action-setup` (it reads `packageManager`), and bump CI to Node 22 (or 24
LTS) in `ci.yml` and `claude.yml`.

### P0-4: Known-vulnerable transitive dependencies

`pnpm audit --prod`: `postcss < 8.5.10` (moderate, via `next > postcss` — the direct dep is
already 8.5.15 but Next resolves its own copy) and `@babel/core ≤ 7.29.0` (low, via
`next > styled-jsx`). Dev-only: `ws < 8.21.0` (high, via `jest-environment-jsdom > jsdom`) plus
four moderates. Build-time-only exposure for most, but they're one `overrides` block away from
zero.

**Action:** add a `pnpm.overrides` block (`"postcss": ">=8.5.15"`, `"@babel/core": ">=7.29.6"`,
`"ws": ">=8.21.0"`), re-run the suites, and add a `pnpm audit --prod --audit-level=high` step (or
`osv-scanner`) to the lint-and-test job so regressions surface in CI rather than in this kind of
review.

---

## P1 — Should do (design gaps and SSDLC baseline)

### P1-1: Hidden game information is readable by every code-holder (cheating)

The entire game state — Uno `hands` for all players, CAH hands, the Codenames key/roles, the
Skribbl secret word — lives in one `jsonb` readable via `get_<game>(code)`. Any player (or anyone
who obtains the invite link) can open DevTools and read opponents' hidden cards. This is inherent
to the "no game server, client-authoritative reducer" architecture and is fine for a
friends-arcade, but it is currently only implied, not stated.

**Action (choose one):**

- Cheapest: document it as an accepted design limit in `README.md`/`CLAUDE.md` ("competitive
  integrity is honor-system") — replacing the stale CONCERNS.md framing.
- Structural (only if it ever matters): split state into public/per-player columns with
  player-token-gated read RPCs, or deal hands from a server-side seed. Large change; not
  recommended for the current threat model.

### P1-2: `room_token` is per-room, not per-player — and `restore_*` hands it to any code-holder

`restore_<game>(code, player_id)` verifies membership by checking `player_id ∈ state.players`,
but player ids are themselves readable via `get_<game>(code)`. So anyone with the room code can
restore as any player and receive the shared write token. Net effect: **the room code alone is
the full write capability**; the token only protects against leaked read-only access. Members can
also trivially impersonate each other (single shared token, client-authoritative reducer).

**Action:** document this honestly (the token is defense-in-depth, not player auth). If per-player
auth is ever wanted: mint a per-player token at join, store `player_id → token_hash` server-side,
and have `dispatch` verify the acting player. Pairs with P1-1; same "only if stakes appear"
caveat.

### P1-3: No SAST / secret scanning / SECURITY.md / LICENSE (SSDLC baseline)

There is no CodeQL (or equivalent) workflow, no committed security policy, no vulnerability
disclosure route, and no LICENSE file (which makes the repo "all rights reserved" by default —
relevant since it's public).

**Action:** enable GitHub code scanning (default CodeQL setup for JS/TS is one click or a
15-line workflow), enable secret scanning + push protection in repo settings, add a short
`SECURITY.md` (how to report; supported = latest deploy), and pick a LICENSE.

### P1-4: Type checking is not an explicit CI gate

There is no `typecheck` script; `tsc --noEmit` never runs. Jest via SWC strips types without
checking them, so the only type gate is `next build` — which runs **last** in the CI chain
(after ~minutes of lint/test/e2e) and only checks files the build graph reaches (e2e/, config
files, and test files are excluded from it).

**Action:** add `"typecheck": "tsc --noEmit"` and run it in the lint-and-test job. Fast fail,
whole-repo coverage including `e2e/` and tests.

### P1-5: GitHub Actions not pinned to SHAs

All actions are tag-pinned (`actions/checkout@v6`, `pnpm/action-setup@v6`,
`anthropics/claude-code-action@v1`, …). Tags are mutable; a compromised upstream tag executes in
a workflow that holds `id-token: write` and Pages deploy rights.

**Action:** pin to full commit SHAs with the tag as a comment; Dependabot (already configured for
`github-actions`) keeps SHA pins fresh automatically.

### P1-6: CI chain serializes everything behind E2E

`lint-and-test → e2e → build → deploy` means a Playwright flake blocks even building, and PR
feedback latency is the sum of all three. Also, e2e runs against `next dev`, not the static
export that actually ships — dev-mode-only behaviors (no export-time errors, different chunking)
pass e2e but can break the real artifact; today that only surfaces at the `build` job with no
functional test against `/out`.

**Action:** run `build` in parallel with `e2e` (both `needs: lint-and-test`), gate `deploy` on
both. Consider a follow-up: serve `/out` with a static server for at least a smoke e2e project so
the shipped artifact is what gets tested.

---

## P2 — Worth doing (quality, correctness details, hygiene)

### P2-1: `pagehide` listener is attached to the wrong target (dead code)

`useGameRoom.ts:727` — `document.addEventListener('pagehide', teardown)`. `pagehide` fires on
`window`, not `document`, so this listener never fires; only the `visibilitychange→hidden` path
does the CLIENT-02 teardown. Change to `window.addEventListener('pagehide', …)` (and the matching
`removeEventListener`).

### P2-2: `supabase/schema.sql` is ~1,500 lines of 6× hand-duplicated SQL

The four RPCs + get + triggers are copy-pasted per game table with only the table name varying.
The comments say "templated source (MIGR-03)" but no template/generator is in the repo — the next
game (or the next fix like P0-1) means editing six near-identical blocks and hoping none drifts.
The join/dispatch validation logic already diverging is exactly how a per-table auth bug slips
in.

**Action:** commit a small generator (e.g. `scripts/generate-schema.ts` rendering per-game blocks
from one template into `schema.sql`) or collapse to generic RPCs taking the game as a validated
enum parameter and using `execute format()` with an allowlisted table map. Add a CI check that
the generated file is up to date.

### P2-3: Coverage gate excludes the most security-relevant code

`collectCoverageFrom: ['src/games/**/logic.ts']` — `useGameRoom.ts` (768 lines, all trust
boundaries), `src/lib/*` (room-code, player-name, uuid, shuffle — tests exist!), and `schema.ts`
files never count toward the ≥80% gate. Tests exist for many of these; they just aren't measured.

**Action:** extend `collectCoverageFrom` to `src/lib/**/*.ts`, `src/hooks/**/*.ts`, and
`src/games/**/schema.ts` (with per-path thresholds if 80% global is too aggressive initially).

### P2-4: Oversized game components

`AgarioGame.tsx` 1,567 / `SkribblGame.tsx` 1,438 / `UnoGame.tsx` 1,278 /
`CardsAgainstHumanityGame.tsx` 1,014 lines. Pure logic is properly extracted, but the render side
concentrates input handling, animation, canvas, and view state in single files that sit outside
the coverage gate. Extract per-phase subcomponents (lobby/round/results are natural seams —
`MindmeldGame`/`CodenamesGame` are already closer to this shape) opportunistically when touching
these files, rather than as a big-bang refactor.

### P2-5: Stale internal docs and comment drift

- `.planning/codebase/CONCERNS.md` (2026-06-12) still describes 4-hex room codes, `using(true)`
  policies, missing schema tests, and missing tab-close handlers — all fixed. A stale security
  doc is worse than none: refresh or delete it (this review can replace its security half).
- `useGameRoom.ts:348` comment says re-read goes "through the still-permissive SELECT (additive
  window)" — it's the `get_*` RPC now.
- Heavy use of plan-codename comments (`D-04`, `ACCESS-03`, `CR-02`, `T-04-02`) that only resolve
  against `.planning/` / past PR docs; fine while those docs live, but prefer self-contained
  rationale for load-bearing security comments.

### P2-6: Small correctness/UX nits

- `dispatch` treats a `22023` (server rejected a player name) as a retryable conflict: it
  refetches and replays the same action up to 3× before showing the generic conflict message.
  Map `22023` to a terminal, accurate error like the existing `42501` branch.
- `lint-staged` runs Prettier only — ESLint issues surface first in CI. Add
  `eslint --fix --max-warnings=0` for staged `*.{ts,tsx}` if you want parity with the pipeline.
- `e2e` remains `workers: 1` because the fake Supabase holds one global state; fine now, but
  wall-clock grows linearly per game. Namespacing fake state per test (e.g. per room-code prefix)
  would unlock parallelism when it starts to hurt.
- No CSP. GitHub Pages can't set response headers, but a
  `<meta http-equiv="Content-Security-Policy">` in `layout.tsx` (self + the Supabase origin for
  connect-src, ws for realtime) is a cheap second layer given the localStorage-held room tokens.
- `pg_cron` cleanup is still a manual, unverifiable step. Consider a belt-and-braces guard: have
  `create_*` opportunistically `delete … where updated_at < now() - interval '24 hours' limit N`
  so orphaned rooms decay even if the cron job was never scheduled.

---

## Summary action table

| #    | Action                                                                        | Effort | Area            |
| ---- | ----------------------------------------------------------------------------- | ------ | --------------- |
| P0-1 | Add `pg_column_size` + roster caps to all write RPCs                          | S      | Security/DoS    |
| P0-2 | Gate `claude.yml` on author association                                       | S      | CI security     |
| P0-3 | Node 22+ in CI, `packageManager` field, unpin pnpm major drift                | S      | SSDLC           |
| P0-4 | `pnpm.overrides` for postcss/babel/ws + `pnpm audit` CI step                  | S      | Dependencies    |
| P1-1 | Document (or redesign) hidden-info visibility to code-holders                 | S/XL   | Trust model     |
| P1-2 | Document token ≠ player auth; optional per-player tokens                      | S/L    | Trust model     |
| P1-3 | CodeQL, secret scanning + push protection, SECURITY.md, LICENSE               | S      | SSDLC           |
| P1-4 | `tsc --noEmit` as an early CI gate                                            | S      | Quality gate    |
| P1-5 | SHA-pin all GitHub Actions                                                    | S      | Supply chain    |
| P1-6 | Parallelize build/e2e; smoke-test the static export                           | M      | CI/CD           |
| P2-1 | Fix `pagehide` listener target (`window`, not `document`)                     | XS     | Bug             |
| P2-2 | Generate or parameterize the 6× duplicated SQL                                | M      | Maintainability |
| P2-3 | Extend coverage gate to `src/lib`, `src/hooks`, `schema.ts`                   | S      | Testing         |
| P2-4 | Decompose 1k+-line game components (opportunistic)                            | M/L    | Maintainability |
| P2-5 | Refresh/retire stale CONCERNS.md + drifted comments                           | S      | Docs            |
| P2-6 | 22023 terminal in dispatch; ESLint in lint-staged; meta-CSP; cleanup fallback | S      | Polish          |
