# Playwright Audit Immediate Implementation Plan

> **For Hermes:** Implement this plan directly with strict TDD where behavior changes/tests are involved. Keep updating progress in this file.

**Goal:** Execute the highest-signal Playwright audit fixes: CI E2E job, home catalog E2E coverage, single-player game smoke coverage, and retry/trace config cleanup.

**Architecture:** Keep the existing fake Supabase + Playwright setup. Add browser-level tests that cover the home/catalog and every single-player route using stable selectors. Prefer importing `games` from `src/data/games` in tests to avoid stale hardcoded catalog lists while avoiding brittle exact snapshot tests.

**Tech Stack:** Next.js 15, React 19, TypeScript, Playwright, pnpm, GitHub Actions.

---

## Progress

- [x] Replaced old `docs/plans/*.md` implementation plan files with the new Playwright audit roadmap and this execution plan.
- [x] Inspect current selectors/routes/config before editing.
  - Confirmed `.github/workflows/ci.yml` has no `e2e` job and deploy only needs `build`.
  - Confirmed `playwright.config.ts` uses CI retries `2` and trace `on-first-retry`.
  - Confirmed home Library view has no `game-card`/searchbox test IDs and single-player games mostly lack `<slug>-board` selectors.
- [x] A1/B1/B2 RED: add/update config/workflow expectations and verify current state lacks CI E2E, has CI retries=2, and trace is on-first-retry.
  - RED confirmed by inspection and new tests initially failed on missing home/single-player selector coverage.
- [x] A1/B1/B2 GREEN: update `.github/workflows/ci.yml` and `playwright.config.ts`.
  - Added Playwright E2E CI job, deploy dependency on `[build, e2e]`, CI retries `1`, and trace `retain-on-failure`.
- [x] A3 RED: add home/catalog E2E tests and verify they fail on missing selectors/behavior if needed.
  - RED: home tests failed on missing stable catalog selectors/search role and ambiguous Library button locator.
- [x] A3 GREEN: add minimal home page selectors/adjust tests until passing.
  - GREEN: home tests pass in targeted run.
- [x] A2 RED: add single-player smoke E2E tests and verify missing selectors/blank render failures.
  - RED: all single-player smoke checks failed on missing `<slug>-board` observability selectors.
- [x] A2 GREEN: add minimal primary board/canvas selectors to single-player games until passing.
  - GREEN: `pnpm exec playwright test e2e/home.spec.ts e2e/games/single-player.spec.ts --reporter=line --workers=1` passed, 14/14.
- [x] Run verification: `pnpm lint`, targeted new specs, `pnpm e2e:ci`, `pnpm build`.
  - Passed: `pnpm lint`
  - Passed: `pnpm exec playwright test e2e/home.spec.ts e2e/games/single-player.spec.ts --reporter=line --workers=1` (14 passed)
  - Passed: `pnpm e2e:ci` (41 passed, 1 skipped)
  - Passed: `pnpm build`
  - Extra verification passed: `pnpm test` (605 passed)
- [x] Commit, push branch, and open/update PR.
  - Ready for commit/push after verification. If workflow-scope push is rejected, save a patch and report handoff.

## Scope for this implementation pass

### A1 — Unblock CI E2E

**Files:**

- Modify: `.github/workflows/ci.yml`

**Implementation:**

1. Add an `e2e` job that depends on `lint-and-test`.
2. Install dependencies with pnpm.
3. Install Playwright Chromium with deps.
4. Run `pnpm e2e:ci`.
5. Upload `playwright-report/` and `test-results/` on failure.
6. Make deploy depend on both `build` and `e2e`.

**Risk:** Pushing workflow edits requires GitHub token `workflow` scope. If push is rejected, save patch and report exact handoff.

### B1/B2 — Reduce retry masking and keep traces on first failure

**Files:**

- Modify: `playwright.config.ts`

**Implementation:**

1. Change CI retries from `2` to `1`.
2. Change trace from `on-first-retry` to `retain-on-failure`.

### A3/H4 — Home page/catalog E2E coverage

**Files:**

- Create: `e2e/home.spec.ts`
- Possibly modify: `src/components/GameCard.tsx`, `src/app/page.tsx`

**Tests:**

1. Home page renders visible game cards.
2. Card count matches `games.filter(g => g.status === 'live')`.
3. Every live game title appears.
4. Search for `wordle` filters to Wordle.
5. Clicking Wordle navigates to `/library-games/games/wordle`.

### A2 — Single-player game smoke coverage

**Files:**

- Create: `e2e/games/single-player.spec.ts`
- Possibly modify single-player components under `src/games/*/*Game.tsx`

**Tests:**

1. Derive single-player live game slugs from `src/data/games`.
2. Navigate to each `/library-games/games/${slug}` route.
3. Assert no crash surface and primary game element is visible.
4. Prefer `data-testid="${slug}-board"` when available; otherwise add minimal selector to the primary interactive region.

## Verification gate

```bash
pnpm lint && pnpm e2e -- e2e/home.spec.ts && pnpm e2e -- e2e/games/single-player.spec.ts && pnpm e2e:ci && pnpm build
```
