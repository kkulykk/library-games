# Playwright E2E Audit & Improvement Roadmap — library-games

> Audit date: 2026-04-26  
> Repo: https://github.com/kkulykk/library-games  
> Test run baseline: 27 passed, 1 skipped (`pnpm e2e:ci`)

---

## 1. What Exists

### Test files

| File                                       | Scope                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `e2e/multiplayer-room-contract.spec.ts`    | Shared create / join / start / leave room flows for all multiplayer games                     |
| `e2e/games/uno.spec.ts`                    | Uno gameplay smoke (deal, play card, turn rotation, draw)                                     |
| `e2e/games/skribbl.spec.ts`                | Skribbl round smoke (word pick, drawer/guesser visibility, guesses, scoring, rotation)        |
| `e2e/games/cards-against-humanity.spec.ts` | CAH smoke (submission, czar judging, score, next-round czar rotation)                         |
| `e2e/games/codenames.spec.ts`              | Codenames smoke (spymaster key, operative redaction, clue, correct guess, assassin win)       |
| `e2e/games/mindmeld.spec.ts`               | Mindmeld smoke (psychic clue, dial lock, reveal scoring, rotation, final leaderboard)         |
| `e2e/games/agario.spec.ts`                 | Agario/Slither.io lifecycle smoke (create/join/start, canvas presence, leaderboard, game-end) |
| `e2e/race-conditions.spec.ts`              | 3 regression tests: concurrent join conflict, concurrent action conflict, reconnect/reload    |

### Infrastructure

- Fake Supabase server (`e2e/fake-supabase/server.mjs`) — deterministic in-process state bus, shared across browser contexts
- Helpers — `players.ts`, `navigation.ts`, `assertions.ts`, `fakeSupabase.ts`
- `data-testid` conventions documented in `docs/e2e.md`
- Selector discipline — shared room IDs (`play-game-button`, `room-code`, `player-roster`, …) plus game-prefixed IDs (`uno-hand-card`, `skribbl-canvas`, etc.)

### Config highlights (from `playwright.config.ts`)

```text
browsers:    Chromium only
workers:     2 (CI), unlimited (local)
retries:     2 (CI), 0 (local)
trace:       on-first-retry
screenshot:  only-on-failure
video:       retain-on-failure
```

---

## 2. What’s Good

- Fake Supabase is the right call. Running tests against a real remote Supabase would be slow, flaky, and credential-dependent. The fake server makes multiplayer state deterministic.
- Hybrid real-UI + seeded-state approach. Exercising the real create/join/start flow in every spec before seeding deep game state is the correct balance — it validates the actual user path while still being deterministic.
- Shared helpers and selector conventions. The `e2e/helpers/` layer and documented `data-testid` conventions prevent selector sprawl early.
- Race condition coverage exists. Most projects skip this entirely. Having concurrent join, concurrent action, and reconnect tests is ahead of the curve.
- TDD workflow documented. The task plans explicitly show RED → GREEN → verify cycles, which is healthy discipline.

---

## 3. Audit Findings

Findings are rated Critical / High / Medium / Low.

### 🔴 CRITICAL — C1: E2E tests do not run in CI

Finding: Task 20 (adding the e2e job to `.github/workflows/ci.yml`) was blocked by a GitHub token scope issue and the patch was never applied. The current CI pipeline runs lint, unit tests, and build — but zero Playwright tests. The 27 E2E tests only run locally.

Impact: Any regression that only a browser-level test can catch will reach main undetected. The E2E suite provides no safety net on PRs.

Fix: Apply the saved workflow patch with a token that has workflow scope, or manually add the job:

```yaml
e2e:
  needs: lint-and-test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '22', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec playwright install --with-deps chromium
    - run: pnpm e2e:ci
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: |
          playwright-report/
          test-results/
```

Gate the deploy job on `e2e` in addition to `build`.

### 🔴 CRITICAL — C2: Zero E2E coverage for all 11 single-player games

Finding: Every game in `e2e/games/` is a multiplayer game. Not a single smoke test exists for Wordle, Minesweeper, 2048, Sudoku, Memory Pairs, Snake, Tetris, Breakout, Hangman, Bounce, or Tic-Tac-Toe. Entire game UIs can be broken — misrouted, blank canvas, crashed on load — and no test will fail.

Impact: Silent breakage of more than half the catalog (11 of 17 live games).

Fix: Add `e2e/games/single-player.spec.ts` with a smoke test per game:

```ts
for (const slug of singlePlayerSlugs) {
  test(`${slug} — page loads and game canvas/board renders`, async ({ page }) => {
    await page.goto(`/library-games/games/${slug}`)
    await expect(page.getByTestId(`${slug}-board`)).toBeVisible()
  })
}
```

Even “page loads and primary interactive element is visible” catches routing failures, blank screens, and JS crashes.

### 🔴 CRITICAL — C3: Home page and Library catalog are entirely untested

Finding: No E2E spec covers `src/app/page.tsx` (Discover + Library home). The hero carousel, trending rail, quick plays, multiplayer spotlight, search input, filter controls, sort controls, and poster-grid are exercised by zero automated tests.

Impact: Broken navigation to games, broken search/filter, broken metadata rendering (wrong title, broken image, missing badge) — all pass CI silently.

Fix: Add `e2e/home.spec.ts`:

```ts
test('Library page renders game catalog', async ({ page }) => {
  await page.goto('/library-games')
  await expect(page.getByTestId('game-card').first()).toBeVisible()
  const cards = page.getByTestId('game-card')
  await expect(cards).toHaveCount(17)
})

test('Search filters games', async ({ page }) => {
  await page.goto('/library-games')
  await page.getByRole('searchbox').fill('wordle')
  await expect(page.getByTestId('game-card')).toHaveCount(1)
  await expect(page.getByText('Wordle')).toBeVisible()
})

test('Clicking a game card navigates to its page', async ({ page }) => {
  await page.goto('/library-games')
  await page.getByText('Wordle').click()
  await expect(page).toHaveURL(/\/library-games\/games\/wordle/)
})
```

### 🟠 HIGH — H1: `retries: 2` in CI masks real flakiness

Finding: With 2 CI retries, a test that fails on the first two attempts and passes on the third is reported as “passed (flaky)” but the run is still green. Over time this normalizes flakiness and hides real race conditions or timing issues.

Impact: Tests that “always pass eventually” slip through code review; the suite degrades silently.

Fix: Drop retries to 1 in CI, or add a dedicated flakiness report step:

```ts
retries: process.env.CI ? 1 : 0,
```

Consider adding a step that fails the build if any test was retried more than once:

```yaml
- name: Fail on flaky tests
  run: |
    if grep -q '"retry":2' test-results/**/*.json 2>/dev/null; then
      echo "Tests required 2 retries — fix flakiness before merging"
      exit 1
    fi
```

### 🟠 HIGH — H2: Chromium-only — no Firefox, WebKit, or mobile coverage

Finding: `playwright.config.ts` has a single project: Desktop Chrome. No Firefox, no Safari/WebKit, no mobile viewport.

Impact: CSS bugs, event-handling differences, or layout regressions that only appear in Firefox or Safari will never be caught.

Fix: Add Firefox and WebKit projects. Keep them optional / nightly to avoid slowing down the main PR gate:

```ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
]
```

Minimal viable: at least add Firefox to the same CI job — most Chrome/Firefox divergences are bugs.

### 🟠 HIGH — H3: Canvas games have no rendering assertions

Finding: `agario.spec.ts` intentionally avoids brittle canvas pixel assertions and tests only that `agario-canvas` is present and some data elements exist. The same likely applies to Snake, Tetris, Breakout, and Bounce. This means rendering bugs, animation freeze, or canvas size regressions are invisible.

Impact: The game could be a black rectangle and the test passes.

Fix: For canvas games, assert at minimum:

- Canvas has non-zero width and height attributes
- Canvas is not blank via a lightweight pixel sample check (`page.evaluate` to read a few pixels after a brief stabilization wait)
- No JS errors in the console (`page.on('console', ...)` assertion)

```ts
const isRendered = await page.evaluate(() => {
  const canvas = document.querySelector('[data-testid="snake-board"]') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  const data = ctx!.getImageData(0, 0, canvas.width, canvas.height).data
  return data.some((v) => v !== 0)
})
expect(isRendered).toBe(true)
```

### 🟠 HIGH — H4: No assertion that game metadata catalog is complete and correct

Finding: `src/data/games.ts` is the source of truth for all 18 game entries. No test verifies that all 17 live games actually appear on the home page, that their slugs route correctly, or that the catalog count hasn’t accidentally dropped.

Impact: Adding a game to `games.ts` but forgetting the route, or accidentally changing a status from live to coming-soon, silently reduces the catalog size.

Fix: Add a catalog integrity test to `e2e/home.spec.ts`:

```ts
import { games } from '../src/data/games'

test('all live games appear in the catalog', async ({ page }) => {
  await page.goto('/library-games')
  const liveGames = games.filter((g) => g.status === 'live')
  for (const game of liveGames) {
    await expect(page.getByText(game.title)).toBeVisible()
  }
})
```

### 🟡 MEDIUM — M1: `trace: 'on-first-retry'` loses traces on first failure in local runs

Finding: When running locally with `retries: 0`, traces are never captured — because a test can only be retried if retries > 0. First-failure debugging without a trace requires manually re-running with `--debug`.

Fix: Change to `trace: 'retain-on-failure'` which captures on any failure regardless of retry:

```ts
use: {
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

### 🟡 MEDIUM — M2: No enforcement of `data-testid` conventions for new code

Finding: `docs/e2e.md` documents the `data-testid` convention, but there is no automated check enforcing it. A new game added without test IDs will silently have no E2E observability.

Fix: Add a lint rule or checklist item to the “Adding a game” section in `CLAUDE.md`:

1. Add `data-testid="<slug>-board"` to the primary game element.
2. Add `data-testid="<slug>-score"` or equivalent observable outcome element.
3. Add the game's smoke spec to `e2e/games/<slug>.spec.ts`.

### 🟡 MEDIUM — M3: Race condition tests may not be truly deterministic

Finding: Tasks 17–18 use Playwright route barriers to simulate concurrent clients. Route barriers add artificial timing, but multi-tab concurrency in a single-process browser is not the same as real concurrent server requests from different users.

Impact: Tests pass green but don’t actually prove the conflict-handling code is correct under real concurrency.

Fix: Supplement browser-level race tests with unit-level tests in `logic.test.ts` that directly test the version-conflict resolution logic with explicit state inputs. The E2E race tests then become smoke-level guards rather than the primary proof of correctness.

### 🟡 MEDIUM — M4: Single skipped test is undocumented

Finding: `pnpm e2e:ci` reports “27 passed, 1 skipped.” There is no explanation in any spec file or doc for what is skipped, why it is skipped, and when it should be un-skipped.

Impact: Skipped tests become permanent dead weight. Without a comment and a tracking issue, they are forgotten.

Fix: Every `test.skip(...)` must have a comment explaining the reason and a link to a GitHub issue.

### 🟡 MEDIUM — M5: Fake Supabase fidelity — RLS, error shapes, and realtime edge cases are not validated

Finding: The fake Supabase server simulates state updates but likely does not replicate RLS rejection responses, Supabase Realtime heartbeat/disconnect behavior, rate-limit error shapes, or malformed payload handling.

Impact: Bugs in how the app handles real Supabase error responses will not be caught until production.

Fix: Add negative-path tests using the fake server’s ability to return error responses and extend `fake-supabase/server.mjs` to support configurable error injection.

### 🟡 MEDIUM — M6: No accessibility (a11y) testing

Finding: No spec uses `@axe-core/playwright` or Playwright’s built-in accessibility snapshots to catch a11y regressions. Games with keyboard controls are not tested for keyboard accessibility.

Fix: Install `@axe-core/playwright` and add a baseline a11y scan to the home page and 2–3 game pages.

### 🟢 LOW — L1: No visual regression baseline

Finding: No visual regression snapshots exist. The UI can visually break while all functional assertions still pass.

Fix: Add Playwright’s built-in `toHaveScreenshot()` for stable, non-animated views — e.g., the Library catalog grid, a game’s lobby screen, a game-over screen.

### 🟢 LOW — L2: No Page Object Model — selectors will drift as the project grows

Finding: Tests use raw `page.getByTestId(...)` calls directly in spec files. With 7+ multiplayer specs and room helpers, the selector surface area is growing.

Fix: Introduce lightweight Page Objects for the most-used surfaces.

### 🟢 LOW — L3: `workers: undefined` locally can cause test interference

Finding: Local runs use unlimited workers (`workers: process.env.CI ? 2 : undefined`). With `fullyParallel: true`, all tests run simultaneously; if any test accidentally writes shared browser storage or fake Supabase global state is not reset properly, local results can be non-deterministic.

Fix: Verify fake Supabase helpers always reset state before each test that seeds state. Consider explicit cleanup hooks in specs that seed custom room state.

---

## 4. Coverage Map

| Area                               | Current coverage     | Target                                  |
| ---------------------------------- | -------------------- | --------------------------------------- |
| Home page (Discover + Library)     | ❌ None              | Smoke + catalog integrity               |
| Single-player games (11 games)     | ❌ None              | Per-game load + play smoke              |
| Multiplayer room contract          | ✅ Solid             | Extend with error paths                 |
| Multiplayer gameplay: Uno          | ✅ Smoke             | Add edge cases (draw 4, skip, UNO call) |
| Multiplayer gameplay: Skribbl      | ✅ Smoke             | Add timer expiry, disconnect mid-round  |
| Multiplayer gameplay: CAH          | ✅ Smoke             | Add tie / empty hand                    |
| Multiplayer gameplay: Codenames    | ✅ Smoke             | Add double-agent word                   |
| Multiplayer gameplay: Mindmeld     | ✅ Smoke             | Add full-team perfect score             |
| Multiplayer gameplay: Agario       | ✅ Minimal smoke     | Canvas rendering assertion              |
| Race conditions / reconnect        | ✅ Basic (3 tests)   | Add real-concurrency unit tests         |
| Error states (wrong code, network) | ❌ None              | Add via fake server injection           |
| Accessibility                      | ❌ None              | axe-core baseline scan                  |
| Visual regression                  | ❌ None              | Snapshot for stable screens             |
| Firefox / WebKit / Mobile          | ❌ None              | Add Firefox to CI, rest nightly         |
| CI integration                     | ❌ Blocked (Task 20) | Unblock immediately                     |

---

## 5. Prioritized Action Items

### Immediate (this sprint)

| #   | Item                                                                                | Effort |
| --- | ----------------------------------------------------------------------------------- | ------ |
| A1  | **Unblock CI E2E** — Apply Task 20 workflow patch with workflow-scoped token        | 1h     |
| A2  | **Add single-player smoke tests** — Load + primary element visible for all 11 games | 3h     |
| A3  | **Add home page tests** — Catalog renders, count matches, search works, navigation  | 2h     |

### Short-term (next 2 weeks)

| #   | Item                                                                     | Effort |
| --- | ------------------------------------------------------------------------ | ------ |
| B1  | **Drop CI retries to 1** — Stop masking flakiness                        | 30m    |
| B2  | **Fix trace config** — Change to `retain-on-failure`                     | 15m    |
| B3  | **Document skipped test** — Comment + GitHub issue                       | 30m    |
| B4  | **Catalog integrity test** — Assert all live games present and routable  | 1h     |
| B5  | **Error-path tests** — Wrong room code, full room, Supabase 500 response | 2h     |

### Medium-term (next month)

| #   | Item                                                                            | Effort |
| --- | ------------------------------------------------------------------------------- | ------ |
| C1  | **Canvas rendering assertions** — Width/height + pixel sample for canvas games  | 3h     |
| C2  | **Add Firefox to CI** — Single additional project in `playwright.config.ts`     | 1h     |
| C3  | **Add axe-core a11y scan** — Home + 2–3 game pages                              | 2h     |
| C4  | **Enforce testid convention in CLAUDE.md** — Checklist for adding new games     | 30m    |
| C5  | **Fake Supabase negative paths** — Configurable error injection in `server.mjs` | 4h     |

### Long-term (ongoing)

| #   | Item                                                                                   | Effort   |
| --- | -------------------------------------------------------------------------------------- | -------- |
| D1  | **Deepen per-game smoke** — Edge cases, error states, time limits                      | Per game |
| D2  | **Visual regression snapshots** — Stable screens (lobby, game-over, library grid)      | 3h       |
| D3  | **Page Object Model** — Refactor room lobby + high-frequency selectors                 | 4h       |
| D4  | **WebKit / mobile viewport CI** — Add to nightly workflow                              | 2h       |
| D5  | **Unit-level race condition tests** — Pure logic tests for version-conflict resolution | 2h       |

---

## 6. Quick Wins Summary

If you can only do three things right now, do these:

1. A1 — Unblock CI E2E. Without this, the entire test suite is optional. It must run on every PR.
2. A2 — Single-player smoke. 11 games with zero coverage is the largest uncovered surface area in the codebase.
3. B1 — Drop retries to 1. This is one line of config that immediately improves signal quality.
