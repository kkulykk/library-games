# Task 10 — Error and Edge Room States Implementation Plan

> For Hermes: execute with strict TDD (RED -> GREEN -> REFACTOR) and keep this file updated.

Goal: Implement Stage 4 Task 10 from `docs/plans/2026-04-24-playwright-e2e-multiplayer.md` by extending room-contract E2E tests to cover deterministic unhappy-path and session edge-state behavior.

Scope:

- Add edge-state tests in `e2e/multiplayer-room-contract.spec.ts` for:
  - invalid room code error
  - joining started game error
  - full room error (where enforceable)
  - leave room returns to entry + session clear behavior
  - reload restores valid session
  - expired/missing session ignored
- Use fake Supabase server mode and shared helpers.

Execution steps:

- [x] 1. Inspect existing room-state UX/messages and session storage behavior.
- [x] 2. RED: add failing edge-state tests.
- [x] 3. Run targeted spec and capture failure output.
- [x] 4. GREEN: implement minimal helper/app changes to satisfy tests.
- [x] 5. Re-run targeted E2E spec until green.
- [x] 6. Run lint.
- [x] 7. Update main multiplayer plan progress section for Task 10.

Progress log:

- Created task plan.
- Inspected `useGameRoom.ts` and multiplayer entry/lobby UX to confirm canonical error messages and session semantics.
- RED: added edge-state tests for invalid code, started-game join rejection, room-full rejection, leave/session clear, reload restore, and expired/malformed session handling.
- First RED run failed on negative-path assumptions and on how-to gate handling after reload/navigation.
- GREEN: updated test flows to use explicit negative-join form submissions, handle `play-game-button` gate when present, and optimize room-full setup via fake Supabase query seeding.
- Added `fakeSupabaseQuery(...)` helper in `e2e/helpers/fakeSupabase.ts` for deterministic fake-backend room setup in E2E.
- Verified green: `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts` (18/18 passing).
- Verified quality: `pnpm lint` passing.
- Updated main multiplayer E2E plan: Task 10 marked complete and next moved to Task 11.
