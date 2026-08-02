# Codebase Analysis — August 2026

A staff-engineer-level review of the repository: what is healthy, what needs
improvement, and how to improve it. All health claims below were verified
against the working tree at the time of writing (`main` at `ea39fc9`).

## Health snapshot (verified, not assumed)

| Check                           | Result                                    |
| ------------------------------- | ----------------------------------------- |
| `pnpm typecheck`                | ✅ clean                                  |
| `pnpm lint` (ESLint + Prettier) | ✅ clean                                  |
| `pnpm test:coverage`            | ✅ 958 tests / 49 suites, all green       |
| `pnpm build` (static export)    | ✅ 21 routes export cleanly               |
| `TODO`/`FIXME`/`any` in `src/`  | ✅ none                                   |
| Logic coverage                  | ✅ most `logic.ts` files at 96–100% lines |

## What is already strong (keep doing this)

These are worth naming because they are the things _not_ to regress:

- **Purity discipline.** Game rules live in `logic.ts` as plain functions with
  near-total unit coverage; React components only render and wire events.
- **One multiplayer engine.** `useGameRoom` owns lifecycle, realtime, presence,
  optimistic CAS dispatch, and session resume; each game configures it in a
  ~30–50-line adapter instead of re-implementing rooms.
- **Generated SQL with a drift gate.** `scripts/generate-schema.mjs` renders all
  7 games' tables + SECURITY DEFINER RPCs from one template, and `check:schema`
  in CI makes hand-edits to `schema.sql` impossible to land.
- **Trust-boundary hygiene.** Every payload crossing the network is Zod
  `safeParse`d; broadcasts are treated as wake-up signals, never authoritative
  state; RPC errors map to stable errcodes, never raw DB messages; state size
  and roster caps guard against abuse; CSP is a named allowlist.
- **A real E2E story.** Fake-Supabase-backed Playwright specs, plus dedicated
  race-condition, accessibility (axe), and visual-regression suites — rare at
  this project size.

The findings below are prioritized improvements, not corrections of a mess.

---

## P1 — Gaps worth closing soon

### 1. CI never builds the static export

`test:all` chains lint → typecheck → check:schema → jest → Playwright, but
Playwright runs against `pnpm dev`. `pnpm build` (`output: 'export'`) is first
exercised by `deploy.yml` — _after_ merge to `main`. A prerender error, a
`basePath` regression, or an export-incompatible API slips through every branch
gate and is discovered as a red deploy on `main`, exactly the failure mode the
CI design tries to prevent.

**How:** add a `build` step to the `test` job (or a parallel job in `test.yml`)
that runs `pnpm build` with dummy Supabase env vars. It is ~20s of CI time
(verified locally) and closes the only untested path to production.

### 2. E2E serialization is the CI scaling bottleneck

`playwright.config.ts` pins `workers: 1` because the fake Supabase server holds
a single shared state that resets between tests. The suite is already ~2,900
lines across 12 spec files and grows with every game; serial execution means CI
wall time grows linearly and this becomes the slowest, most contested part of
the pipeline.

**How:** make the fake server multi-tenant instead of shared-mutable:

- Option A (smaller): key fake-server state by room code and drop the global
  reset; each test already creates its own room, so most specs isolate
  naturally.
- Option B (cleaner): launch one fake-server instance per Playwright worker on
  `54321 + workerIndex` (via a worker-scoped fixture) and point each context's
  `NEXT_PUBLIC_SUPABASE_URL` at its own instance. Then set
  `fullyParallel: true` and raise `workers`.

---

## P2 — Structural improvements

### 3. The client-authoritative multiplayer model has a known ceiling — make it explicit

There is no server-side referee: any room member holding the room token can
write _any_ schema-valid state (the dispatch RPC validates shape, size, and
membership — not legality of the move), and all hidden information travels in
the shared `jsonb` state readable by every member. Uno hands, CAH hands, the
Codenames key, and Skribbl's current word (base64-obfuscated only) are all
visible in devtools; a motivated player can cheat freely.

For a friends-only party arcade this is a reasonable trade-off — the hardening
work already done (tokens, caps, Zod, CSP) correctly targets _abuse_, not
_cheating_. But the boundary should be written down so future work doesn't
half-fix it:

**How:**

- Document "fair-play enforcement is out of scope; rooms trust their members"
  in `SECURITY.md` and `CLAUDE.md` as an explicit non-goal.
- If a competitive mode ever matters, the escalation path is moving
  `applyAction` into a Supabase Edge Function per game (dispatch sends the
  _action_, the server computes the state) — the pure-reducer design means the
  same `logic.ts` could run server-side with modest plumbing. Don't build this
  speculatively; just know it's the path.

### 4. Game components are single-file monoliths

`GlobetrotterGame.tsx` (1,699 lines), `AgarioGame.tsx` (1,567),
`SkribblGame.tsx` (1,547), `UnoGame.tsx` (1,245), `CardsAgainstHumanityGame.tsx`
(1,014). They are internally well-decomposed into screen functions
(`EntryScreen`, `LobbyScreen`, `RoundEndScreen`, …), so this is file
organization, not architecture — but at this size, unrelated screens share one
diff surface, reviews get noisy, and editor/tooling ergonomics suffer.

**How:** mechanically split each game's screens into
`src/games/<slug>/screens/*.tsx`, keeping the top-level `<Name>Game.tsx` as the
orchestrator. No behavior change, e2e suites already pin the behavior.

### 5. The multiplayer screen-flow orchestration is duplicated ×7

The shared component library (`RoomEntry`, `LobbyActions`, `PlayerRoster`,
`ResumeSessionCard`, `DesyncIndicator`, …) is genuinely reused — good. What each
game still re-implements is the _flow_: the `SetupRequired` /
`InviteResolvingScreen` / how-to → entry → lobby → in-game routing driven by
`status`, `gameState.phase`, and `isSupabaseConfigured`. That's a few hundred
near-identical lines per game and a per-game opportunity for the flows to
drift.

**How:** extract a `MultiplayerFlow` (or extend `ArcadeShell`) component that
owns the state machine and takes the game-specific screens as slots/render
props plus a copy object. Migrate one game (Uno is the simplest), verify with
its e2e suite, then roll through the rest. This also drops the marginal cost of
game #8.

### 6. `useGameRoom` unit coverage is the weakest of any measured file

69.9% lines: `joinRoom` (lines ~491–576), `restoreSession` (~581–626), and
`leaveRoom` (~705–738) are essentially uncovered by jest and rely on Playwright.
Those paths contain the subtlest logic in the codebase (CAS join races, legacy
token-less session upgrade, teardown ordering) and e2e failure modes there are
the hardest to debug.

**How:** add jest tests driving those three paths against a stubbed
`SupabaseBoundary` (the seam already exists in `lib/supabase.ts`), covering:
join CAS conflict (40001), join into a full/started room, restore with a dead
room, restore re-issuing a token for a legacy session, and leave retrying on
conflict. Then raise the `src/hooks/**` coverage floor in `jest.config.js` so
it can't slide back.

---

## P3 — Smaller, still worth doing

### 7. No production observability

Every failure path ends in `console.error` — desyncs, RPC failures, invalid
payloads, CSP blocks are invisible once deployed. The Globetrotter CSP outage
described in `lib/csp.ts` ("every Wikimedia call failed in production while
working locally") is exactly the class of incident that currently gets found by
a player, not a signal.

**How:** add a minimal client error reporter — either a tiny handler posting
`window.onerror` / `unhandledrejection` / a `reportDesync()` counter to a free
Sentry (add its origin to `csp.ts` in the same change), or at minimum a
`SecurityPolicyViolationEvent` listener so CSP misses are loud in dev. Keep it
out of the hot path; sample if volume matters.

### 8. Dead surface on the Supabase boundary

`SupabaseBoundary.from()` and the whole `QueryBuilderBoundary` type in
`src/lib/supabase.ts` (and the matching `from()` in the fake client) have no
production callers left — everything goes through RPCs since the Phase-2
hardening. Dead seams on a security boundary invite un-reviewed reuse.

**How:** delete `from()`/`QueryBuilderBoundary` from the boundary type and the
fake; the compiler will confirm nothing breaks.

### 9. Lint config papering over a real rule

`react-hooks/set-state-in-effect` is disabled globally in `eslint.config.mjs`.
That rule catches genuine render-loop/perf bugs; a global off means new code
gets no protection because some existing effects (e.g. session load) legitimately
set state.

**How:** re-enable it and convert the handful of legitimate sites to targeted
`// eslint-disable-next-line` with a reason, or refactor them (the
`loadSession` effect can become a `useSyncExternalStore`/lazy-init pattern).
Similarly, `@typescript-eslint/no-explicit-any` can be `error` instead of
`warn` — the codebase already has zero violations, so lock it in.

### 10. Heavy per-game data is statically imported

`countryPolygons.json` (292 KB) + `landPolygons.json` (116 KB) land in
Globetrotter's bundle, `wordle-valid-guesses.json` (116 KB) in Wordle's,
`cards.ts` (76 KB) in CAH's. Route-level code splitting keeps this off the home
page, so it's not urgent — but it is dead weight on first paint of those game
pages, and the polygons aren't needed until a round starts.

**How:** move the biggest payloads behind `await import(...)` at the point of
first use (deck build / first guess validation), or fetch them from
`public/` as JSON. Do Globetrotter's polygons first; skip anything under
~30 KB.

### 11. Ops and paper-cuts

- **`pg_cron` cleanup is a manual, unverifiable step.** If it's ever not
  scheduled on a fresh project, rooms accumulate forever and nothing notices.
  Add a check to the opt-in `test:supabase` canary that asserts the cron job
  exists (query `cron.job`), so the drift is at least detectable on demand.
- **README table drift risk.** Counts and rows ("18 total titles", statuses)
  are hand-maintained next to `src/data/games.ts`, which is the declared single
  source of truth. Either generate the table from `games.ts` with a small
  script, or trim the README to prose that can't go stale.
- **Naming:** the `agario` slug ships under the title "Slither.io" — pick one
  identity to save future contributors the double-take.

---

## Suggested sequencing

1. **Now (hours):** #1 build-in-CI, #8 dead boundary code, #9 lint rules.
2. **Next (a day or two each):** #6 `useGameRoom` tests, #2 e2e
   parallelization, #3 documentation of the trust model.
3. **Opportunistic (as files are touched):** #4 screen splits, #5 shared flow,
   #10 lazy data, #11 paper-cuts.

The codebase does not need a rescue; it needs the CI gate to cover the build,
the test pyramid to reach the room engine, and the E2E suite to be allowed to
scale. Everything else is compounding-interest cleanup.
