# Task 11 — Uno Full Turn Smoke Test Implementation Plan

> For Hermes: execute with strict TDD (RED -> GREEN -> REFACTOR) and keep this file updated.

Goal: Implement Stage 5 Task 11 from `docs/plans/2026-04-24-playwright-e2e-multiplayer.md` by adding deterministic Uno gameplay E2E coverage.

Scope:

- Add `e2e/games/uno.spec.ts` covering:
  - host creates room
  - guest joins room
  - host starts game
  - both players see hands, draw pile, discard pile, and current-turn status
  - current player plays a valid card and turn advances
  - near-win seeded state finishes the game when final card is played
  - winner/end screen is visible on both player pages
- Add only stable `data-testid` hooks needed for deterministic gameplay assertions.
- Use fake Supabase server state seeding instead of real Supabase or random deck assumptions.

Execution steps:

- [x] 1. Inspect Uno UI, logic, shared E2E helpers, and fake Supabase query helper.
- [x] 2. RED: add failing Uno E2E spec for start/play/win flow.
- [x] 3. Run targeted spec and capture failure output.
- [x] 4. GREEN: add minimal test IDs/helpers/app changes to satisfy the spec.
- [x] 5. Re-run targeted Uno E2E spec until green.
- [x] 6. Run lint, Jest, build, and relevant E2E specs.
- [x] 7. Update main multiplayer plan progress section for Task 11.
- [x] 8. Commit, push branch, and open PR.

Validation:

- RED observed: `pnpm e2e -- e2e/games/uno.spec.ts` failed because `data-testid="uno-status"` did not exist yet.
- GREEN: `pnpm e2e -- e2e/games/uno.spec.ts` passed (1/1).
- Final gates:
  - `pnpm lint` passed.
  - `pnpm test` passed (30 suites, 605 tests).
  - `pnpm e2e -- e2e/games/uno.spec.ts` passed (1/1).
  - `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts` passed (18/18).
  - `pnpm build` passed.

Progress log:

- Created fresh branch `feat/uno-e2e-smoke` from latest `origin/main` after PR #117 was merged.
- Created this implementation plan before touching production/test code.
- Inspected `UnoGame.tsx`, `logic.ts`, `useUnoRoom.ts`, existing room-contract specs, and fake Supabase helpers.
- Opened PR #118: https://github.com/kkulykk/library-games/pull/118
