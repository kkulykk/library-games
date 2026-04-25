# Task 13 — Cards Against Humanity Smoke Test Implementation Plan

> For Hermes: execute with strict TDD (RED -> GREEN -> REFACTOR) and keep this file updated.

Goal: Implement Stage 5 Task 13 from `docs/plans/2026-04-24-playwright-e2e-multiplayer.md` by adding deterministic Cards Against Humanity gameplay E2E coverage.

Scope:

- Add `e2e/games/cards-against-humanity.spec.ts` covering:
  - host creates room
  - three guests join room so the game has enough players
  - host starts game
  - deterministic playing state is seeded through fake Supabase
  - Card Czar sees waiting state and cannot submit a white card
  - non-czar players select and submit white cards
  - judging phase shows anonymized face-down submissions
  - Czar reveals submissions one-by-one
  - Czar picks a winning submission
  - reveal phase shows winning player/card and score increment
  - Czar advances to next round and Card Czar rotates
- Add only stable `data-testid` hooks needed for deterministic gameplay assertions.
- Use fake Supabase server state seeding instead of relying on random black/white deck outcomes.

Execution steps:

- [x] 1. Inspect current PR state and Cards Against Humanity UI, logic, schema, and room hook.
- [x] 2. Update global plan to show Task 13 in progress.
- [x] 3. RED: add failing CAH E2E spec for submit/judge/reveal/next-round flow.
- [x] 4. Run targeted spec and capture failure output.
- [x] 5. GREEN: add minimal selectors/helpers/app changes to satisfy the spec.
- [x] 6. Re-run targeted CAH E2E spec until green.
- [x] 7. Run lint, Jest, build, and relevant E2E regression specs.
- [x] 8. Update global plan progress for Task 13 completion and next task.
- [ ] 9. Commit, push, and update PR #118.

Validation:

- RED observed: `pnpm e2e -- e2e/games/cards-against-humanity.spec.ts` failed because `data-testid="cah-status"` did not exist yet.
- GREEN: `pnpm e2e -- e2e/games/cards-against-humanity.spec.ts` passed (1/1).
- Final gates:
  - `pnpm lint` passed.
  - `pnpm test` passed (30 suites, 605 tests).
  - `pnpm e2e -- e2e/games/cards-against-humanity.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/games/skribbl.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/games/uno.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts` passed (18/18).
  - `pnpm build` passed.

Progress log:

- Continuing on `feat/uno-e2e-smoke`, PR #118.
- Inspected `CardsAgainstHumanityGame.tsx`, `logic.ts`, `schema.ts`, and `useCAHRoom.ts`.
