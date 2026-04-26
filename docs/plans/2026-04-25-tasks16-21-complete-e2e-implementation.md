# Remaining Multiplayer E2E Tasks 16-21 Implementation Plan

> **For Hermes:** Implement this plan directly with strict TDD where behavior changes/tests are involved. Keep updating progress in this file.

**Goal:** Finish the multiplayer E2E roadmap by adding Agario/Slither.io smoke coverage, race/reconnect regression tests, CI Playwright execution, and E2E documentation.

**Architecture:** Continue on the active E2E roadmap branch/PR and keep coverage deterministic with the existing fake Supabase backend. Use real browser create/join/start flows first, then use fake Supabase queries or broadcasts only where needed to avoid random/time-based gameplay flake. Add stable semantic selectors only where existing DOM is not observable.

**Tech Stack:** Next.js static app, React 19, TypeScript, pnpm, Playwright, fake Supabase E2E server, GitHub Actions.

---

## Progress

- [x] Inspected current branch and remaining roadmap tasks.
- [x] Created this Tasks 16-21 implementation plan.
- [x] Task 16 RED: write Agario smoke spec and confirm it fails on missing selectors/coverage.
  - RED: `pnpm e2e -- e2e/games/agario.spec.ts` failed on missing `agario-canvas` selector.
- [x] Task 16 GREEN: add minimal Agario selectors and make smoke spec pass.
  - GREEN: `pnpm e2e -- e2e/games/agario.spec.ts` passed, 1/1.
- [x] Tasks 17-19 RED: write race/reconnect regression spec and confirm targeted failures.
  - RED: initial `pnpm e2e -- e2e/race-conditions.spec.ts` exposed missing/insufficient stable UI assertions for round-end chat and in-game Uno leave controls.
- [x] Tasks 17-19 GREEN: add only minimal helpers/behavior changes if required and make spec pass.
  - GREEN: `pnpm e2e -- e2e/race-conditions.spec.ts` passed, 3/3.
- [!] Task 20: prepared Playwright E2E GitHub Actions patch, but the current token cannot push workflow-file changes without `workflow` scope.
  - Saved patch: `/tmp/library-games-e2e-ci-workflow.patch`
- [x] Task 21: document E2E commands, fake Supabase, selector conventions, and debugging.
- [x] Update global roadmap progress for Tasks 16-21.
- [x] Run verification gate.
  - Passed after `pnpm lint:fix`: `pnpm lint`, `pnpm test`, targeted Agario E2E, race-conditions E2E, full `pnpm e2e:ci` (27 passed, 1 skipped), and `pnpm build`.
- [x] Commit, push, and update PR #119.
  - PR: https://github.com/kkulykk/library-games/pull/119
  - Branch pushed at `5717630`.
  - PR body updated with implemented tasks, validation results, and Task 20 workflow-token note.

## Task 16 — Agario/Slither.io smoke test

**Objective:** Cover realtime gameplay lifecycle without pixel/canvas assertions.

**Files:**

- Create: `e2e/games/agario.spec.ts`
- Modify: `src/games/agario/AgarioGame.tsx`

**Steps:**

1. Write `e2e/games/agario.spec.ts` using real create/join/start flow.
2. Broadcast deterministic `game_start` and `game_end` messages through the fake Supabase `/broadcast` endpoint.
3. Assert both players see `agario-canvas`, cross-client leaderboard presence, and final scores.
4. Run `pnpm e2e -- e2e/games/agario.spec.ts` and confirm RED failure from missing selectors.
5. Add minimal selectors: `agario-canvas`, `agario-game-area`, `agario-leaderboard`, `agario-leaderboard-row`, `agario-finished`, `agario-final-scores`, `agario-final-score-row`.
6. Re-run targeted spec and confirm GREEN.

## Tasks 17-19 — Race and reconnect tests

**Objective:** Add deterministic regression coverage for optimistic version conflicts and restore/subscription behavior.

**Files:**

- Create: `e2e/race-conditions.spec.ts`

**Task 17:** Concurrent join conflict

- Use Uno.
- Create host room.
- Two guests join concurrently through browser UI with a route barrier that makes both joiners read the same room version.
- Assert final room contains host + exactly one guest, no overwrite, and the losing guest sees retryable error.

**Task 18:** Concurrent action conflict

- Use Skribbl correct guesses.
- Seed deterministic drawing state.
- Two guessers submit correct guesses concurrently with a route barrier on first update.
- Assert dispatch retry preserves both guessed players/messages and host sees round end.

**Task 19:** Reconnect/reload resilience

- Use Uno.
- Guest joins, reloads, resumes, then host starts game.
- Assert restored guest receives the later playing-state update.
- Guest leaves, reloads, and does not auto-rejoin.

## Task 20 — CI integration

**Objective:** Run Playwright in GitHub Actions and upload artifacts on failure.

**Files:**

- Modify: `.github/workflows/ci.yml`

**Steps:**

1. Add `e2e` job after `lint-and-test`.
2. Install dependencies and Playwright Chromium with deps.
3. Run `pnpm e2e:ci`.
4. Upload `playwright-report/` and `test-results/` on failure.
5. Gate deploy on both `build` and `e2e`.

**Caution:** Pushing workflow edits may require a GitHub token with workflow permission.

## Task 21 — Documentation

**Objective:** Make E2E runnable/debuggable by humans who do not have all this context loaded in their brain meat.

**Files:**

- Create: `docs/e2e.md`
- Modify: `README.md`

**Document:**

- Local E2E commands.
- Fake Supabase server/client and env vars.
- How to add game specs.
- Selector conventions.
- CI artifacts and trace/report debugging.

## Verification Gate

Run before commit/push:

```bash
pnpm lint && pnpm test && pnpm e2e -- e2e/games/agario.spec.ts && pnpm e2e -- e2e/race-conditions.spec.ts && pnpm e2e:ci && pnpm build
```

If time is ugly, run targeted specs first while iterating, then the full gate before final commit.
