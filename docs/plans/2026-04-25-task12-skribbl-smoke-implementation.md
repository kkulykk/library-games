# Task 12 — Skribbl Round Smoke Test Implementation Plan

> For Hermes: execute with strict TDD (RED -> GREEN -> REFACTOR) and keep this file updated.

Goal: Implement Stage 5 Task 12 from `docs/plans/2026-04-24-playwright-e2e-multiplayer.md` by adding deterministic Skribbl gameplay E2E coverage.

Scope:

- Add `e2e/games/skribbl.spec.ts` covering:
  - host creates room
  - two guests join room
  - host starts game
  - drawer sees word choices while guessers see waiting state
  - deterministic drawing state is seeded through fake Supabase
  - drawer sees the hidden word while guessers only see the hint mask
  - canvas is visible and synced across contexts
  - wrong guess appears in chat without score/guessed state
  - correct guess marks the guesser, updates score, and surfaces system message
  - round-end state reveals the word to all players
  - host advances to next turn and drawer rotates
- Add only stable `data-testid` hooks needed for deterministic gameplay assertions.
- Use fake Supabase server state seeding instead of relying on random word choices or timer delays.

Execution steps:

- [x] 1. Inspect current branch, global E2E plan, Skribbl UI, logic, schema, and fake Supabase helpers.
- [x] 2. Update global plan to show Task 12 in progress.
- [x] 3. RED: add failing Skribbl E2E spec for picking/drawing/guess/round-end/rotation flow.
- [x] 4. Run targeted spec and capture failure output.
- [x] 5. GREEN: add minimal selectors/helpers/app changes to satisfy the spec.
- [x] 6. Re-run targeted Skribbl E2E spec until green.
- [x] 7. Run lint, Jest, build, and relevant E2E regression specs.
- [x] 8. Update global plan progress for Task 12 completion and next task.
- [x] 9. Commit, push, and update PR #118.

Validation:

- RED observed: `pnpm e2e -- e2e/games/skribbl.spec.ts` failed because `data-testid="skribbl-word-option"` did not exist yet.
- GREEN: `pnpm e2e -- e2e/games/skribbl.spec.ts` passed (1/1).
- Final gates:
  - `pnpm lint` passed.
  - `pnpm test` passed (30 suites, 605 tests).
  - `pnpm e2e -- e2e/games/skribbl.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/games/uno.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts` passed (18/18).
  - `pnpm build` passed.

Progress log:

- Continuing on `feat/uno-e2e-smoke`, which already backs PR #118.
- Confirmed global plan currently has Tasks 1–11 complete and Task 12 next.
- Inspected `SkribblGame.tsx`, `logic.ts`, and `schema.ts` to identify needed selectors and seedable state shape.
