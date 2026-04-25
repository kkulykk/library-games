# Task 9 — Join Room Contract Spec Implementation Plan

> For Hermes: execute with strict TDD (RED -> GREEN -> REFACTOR) and keep this file updated.

Goal: Implement Stage 4 Task 9 from `docs/plans/2026-04-24-playwright-e2e-multiplayer.md` by extending `e2e/multiplayer-room-contract.spec.ts` to validate cross-context join flow for all live multiplayer slugs.

Scope:

- Add join-room contract tests for `skribbl`, `uno`, `agario`, `cards-against-humanity`, `codenames`, `mindmeld`.
- Use existing helper primitives where possible.
- Keep deterministic fake Supabase flow.

Execution steps:

- [x] 1. RED: add failing join-room contract test(s) in `e2e/multiplayer-room-contract.spec.ts`.
- [x] 2. Run targeted spec and capture failure output.
- [x] 3. GREEN: implement minimal changes (helpers/spec/UI test IDs if needed) to make tests pass.
- [x] 4. Run targeted E2E spec to verify green.
- [x] 5. Run lint and fix formatting issues.
- [x] 6. Update main plan progress section to mark Task 9 complete and set next task.

Progress log:

- Created task plan.
- RED: Added cross-context join-room contract test for each live multiplayer slug. Initial run failed on Uno join flow (guest stuck before join due rules gate).
- GREEN: Updated `joinRoom(...)` helper to click `play-game-button` when present, matching create flow behavior.
- Verified green: `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts` (12/12 passing).
- Verified quality: `pnpm lint` passing after formatting this plan file.
- Updated main multiplayer E2E plan progress: Task 9 marked complete; next set to Task 10.
