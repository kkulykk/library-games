# Analysis follow-up — progress log

Tracking implementation of items from
[`codebase-analysis-2026-08.md`](./codebase-analysis-2026-08.md).

Scope for this pass: the report's own "Now (hours)" bucket — **#1**, **#8**, **#9**.

| #   | Item                                  | Priority | Status  |
| --- | ------------------------------------- | -------- | ------- |
| 1   | CI never builds the static export     | P1       | ✅ done |
| 8   | Dead surface on the Supabase boundary | P3       | ✅ done |
| 9   | Lint config papering over a real rule | P3       | ✅ done |

Not in this pass: #2 (e2e parallelization), #3 (trust-model docs), #4 (screen
splits), #5 (shared multiplayer flow), #6 (`useGameRoom` tests), #7
(observability), #10 (lazy data), #11 (ops paper-cuts). See
[Next up](#next-up) for what the sequencing suggests taking next.

**Verification for this pass.** The full gate was run locally and is green:
`lint` + `typecheck` + `check:schema` clean, jest **958 passed / 49 suites**,
Playwright **70 passed**, `pnpm build` exports 20 routes.

---

## #1 — CI never builds the static export

**Problem.** `test:all` chained lint → typecheck → check:schema → jest →
Playwright, and Playwright runs against `pnpm dev`. `pnpm build`
(`output: 'export'`) was first exercised by `deploy.yml`, _after_ merge to
`main`, so a prerender error or `basePath` regression surfaced as a red deploy
rather than a red branch.

**What changed.**

- `package.json` — `test:all` now ends with `pnpm build`.
- `.github/workflows/test.yml` — placeholder Supabase env vars on the `test`
  job so the build renders the configured code path rather than the "Supabase
  not set up" one. Nothing contacts Supabase at build time; the vars only need
  to be non-empty. Playwright's `webServer` sets its own env, so the e2e run is
  unaffected.
- `CLAUDE.md` — CI section updated.

**Why `build` runs last.** It is the most expensive check, so cheaper ones
should fail first — and `next build` writing `.next/` before the e2e run would
collide with the `next dev` server Playwright starts. Kept inside `test:all`
rather than added as a separate workflow step, per the existing "the whole gate
is one command locally and in CI" rule.

**Cost.** ~20s of CI time (measured).

### Follow-up: the placeholder env vars broke the e2e run

The first CI run on this branch went red — 51 e2e failures across specs the
change never touched, all `ENOTFOUND ci-placeholder.supabase.co`.

Cause: three e2e files and `playwright.config.ts` derived the **fake server's
own address** from `NEXT_PUBLIC_SUPABASE_URL`
(`process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'`). That
variable is the _app's_ backend address, not the harness's, so the job-level
placeholder redirected the harness's own `/reset` and `/admin/query` calls at a
domain that does not resolve. Every spec using the shared `test` fixture died
in `resetFakeSupabase`.

Local verification missed it because the build was checked _with_ those vars
and the e2e suite _without_ them — never both at once, which is precisely the
CI configuration.

**Fix:** `e2e/helpers/fakeSupabaseUrl.ts` now owns the address as
`FAKE_SUPABASE_URL` (override via `FAKE_SUPABASE_URL`, default
`http://127.0.0.1:54321`), and `helpers/fakeSupabase.ts`,
`race-conditions.spec.ts`, `games/agario.spec.ts` and `playwright.config.ts`
all read it. The harness can no longer be redirected by an ambient app
variable. Re-verified with `NEXT_PUBLIC_SUPABASE_*` exported to the CI
placeholders: **70 Playwright tests passed**.

---

## #8 — Dead surface on the Supabase boundary

**Problem.** `SupabaseBoundary.from()` and `QueryBuilderBoundary` in
`src/lib/supabase.ts` had no callers left — everything goes through the
SECURITY DEFINER RPCs since the Phase-2 hardening, and Phase 3 sealed the
tables behind default-deny RLS. A dead seam on a security boundary invites
un-reviewed reuse.

**What changed.**

- `src/lib/supabase.ts` — deleted `from()`, `QueryBuilderBoundary`, and the
  `QueryResult` helper. Left a comment on `SupabaseBoundary` recording that the
  omission is deliberate and that re-adding it means re-opening RLS.
- `src/lib/e2e/fake-supabase.ts` — deleted the matching `from()` and the whole
  `FakeQueryBuilder` class, so the fake cannot be more permissive than
  production.
- `e2e/fake-supabase/server.mjs` — the anon `/query` seal-emulation handler is
  **kept** (it costs nothing and keeps the anon-vs-`/admin/query` split
  legible), but its comment no longer claims to be the thing that catches a
  direct-table regression. That is now a type error instead.

`pnpm typecheck` confirms nothing else referenced either symbol.

### Adjacent bug found and fixed

Removing the seam surfaced a real defect in `e2e/race-conditions.spec.ts`. The
"skribbl retries concurrent correct guesses" barrier predicated on a
`/query` direct-table `update` payload (`op`/`table`/`values.state`) — a shape
the app stopped sending when writes moved to `dispatch_<game>`. The predicate
therefore **never matched**: nothing blocked, the two guesses serialized, and
the test kept passing while exercising no race at all.

Fixed by rewriting the barrier against the RPC payload shape
(`fn`/`args.p_new_state`), and — so this cannot rot silently again —
`installQueryBarrier` now returns an `assertBarrierFired()` that every caller
awaits after the concurrent actions. A stale predicate is now a test failure
with a message that says so, not a silent no-op. Both barriers verified to
actually fire.

---

## #9 — Lint config papering over a real rule

**Problem.** `react-hooks/set-state-in-effect` was `off` globally, so new code
got no protection from render-loop bugs. `@typescript-eslint/no-explicit-any`
was `warn` despite zero violations.

**What changed.**

- `eslint.config.mjs` — both rules promoted to `error`.
- `package.json` — `lint` now runs `eslint . --max-warnings=0`. This turned out
  to matter: `pnpm lint` was plain `eslint .`, so **any warning already passed
  CI**, which is why `no-explicit-any` at `warn` was not really enforced. It
  also matches the lint-staged hook, which already used `--max-warnings=0`.
- 17 pre-existing violations resolved (below).

**One refactor, not a suppression.** `TicTacToeGame`'s `aiThinking` was a piece
of state mirroring something already derivable:
`mode === 'single' && currentPlayer === 'O' && !isGameOver(state)`. It is now
derived during render, which deletes a `useState` and two setter calls, and
removes the class of bug where a path that ends the AI's turn forgets to clear
the flag. 23 unit tests still pass.

**The other 16 sites are targeted suppressions**, each on the setter line with
a short `--` reason and the fuller explanation in a comment above. They fall
into three honest categories:

1. **Post-mount external-store reads** (`useInviteCode`, `HomeExperience` tab,
   Tetris high score). The pages are statically exported, so `localStorage` and
   `window.location` do not exist at build time; moving these into render or a
   lazy `useState` initializer would be a hydration mismatch. Run once.
2. **Resets driven by incoming room state** (CAH selection, Mindmeld clue and
   slider, Skribbl strokes, Globetrotter scout notice, the invite-code →
   entry-screen effects in Uno/Skribbl/Globetrotter). These react to network
   state arriving, not to a render, and settle in one pass.
3. **Pre-arming an external timer or async call** (Skribbl round-end countdown,
   Globetrotter place-name lookup, Uno discard animation). Each is guarded so it
   runs at most once per round/card.

**Note on directive syntax.** `// eslint-disable-next-line <rule> -- <reason>`
applies to the next _line_, and each `//` is its own comment — so a reason
wrapped onto a second `//` line silently detaches the directive from the code
and leaves the violation unsuppressed. With `--max-warnings=0` this is now
caught (ESLint reports unused directives as warnings), which also makes stale
suppressions self-cleaning: refactor the effect away and CI tells you to delete
the comment.

`CLAUDE.md` documents the convention so the next contributor suppresses at the
line rather than reaching for the global `off` again.

---

## Next up

Following the report's sequencing, the next bucket is #6 (`useGameRoom` jest
coverage — currently 69.9% lines, with `joinRoom` / `restoreSession` /
`leaveRoom` essentially untested), #2 (e2e parallelization), and #3 (writing
down the client-authoritative trust model as an explicit non-goal).

#6 is the highest-value of the three: those paths hold the subtlest logic in
the codebase, and the race-condition barrier bug found above is a concrete
example of e2e coverage that looked stronger than it was.
