# Task 14 — Codenames Smoke Test Implementation Plan

> For Hermes: execute with strict TDD (RED -> GREEN -> REFACTOR) and keep this file updated.

Goal: Implement Stage 5 Task 14 from `docs/plans/2026-04-24-playwright-e2e-multiplayer.md` by adding deterministic Codenames gameplay E2E coverage.

Scope:

- Add `e2e/games/codenames.spec.ts` covering:
  - host creates room
  - three guests join room so each team has a spymaster and operative
  - deterministic playing state is seeded through fake Supabase
  - spymaster sees board color/key information for unrevealed cards
  - operative does not see board key information for unrevealed cards
  - red spymaster submits a clue
  - red operative sees clue and guesses a red card
  - score/remaining count updates after correct guess
  - assassin guess ends the game and awards the other team
- Add only stable `data-testid` hooks needed for deterministic gameplay assertions.
- Use fake Supabase server state seeding instead of relying on random board generation.

Execution steps:

- [x] 1. Inspect current PR state and Codenames UI, logic, schema, and room hook.
- [x] 2. Update global plan to show Task 14 in progress.
- [x] 3. RED: add failing Codenames E2E spec for clue/guess/assassin flow.
- [x] 4. Run targeted spec and capture failure output.
- [x] 5. GREEN: add minimal selectors/helpers/app changes to satisfy the spec.
- [x] 6. Re-run targeted Codenames E2E spec until green.
- [x] 7. Run lint, Jest, build, and relevant E2E regression specs.
- [x] 8. Update global plan progress for Task 14 completion and next task.
- [x] 9. Commit, push, and update PR #118.

Validation:

- RED observed: `pnpm e2e -- e2e/games/codenames.spec.ts` failed because `data-testid="codenames-status"` did not exist yet.
- GREEN: `pnpm e2e -- e2e/games/codenames.spec.ts` passed (1/1).
- Final gates:
  - `pnpm lint` passed.
  - `pnpm test` passed (30 suites, 605 tests).
  - `pnpm e2e -- e2e/games/codenames.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/games/cards-against-humanity.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/games/skribbl.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/games/uno.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts` passed (18/18).
  - `pnpm build` passed.

Progress log:

- Continuing on `feat/uno-e2e-smoke`, PR #118.
- Inspected `CodenamesGame.tsx`, `logic.ts`, `schema.ts`, and `useCodenamesRoom.ts`.
- Committed and pushed Task 14 implementation to PR #118.
- Latest checked GitHub status for implementation commit `2e80ad8`: Build, CodeQL, Lint & Test, Analyze (javascript-typescript), and Analyze (actions) passed; Deploy skipped; `claude-review` failed and needs follow-up.
- After latest documentation-status commit, GitHub checks restarted and were in progress when last checked.
