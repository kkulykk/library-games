# Task 15 Mindmeld Smoke Test Implementation Plan

> **For Hermes:** Follow test-driven-development. Write the Playwright spec first, watch it fail, then add the minimum stable selectors/implementation needed to pass.

**Goal:** Add deterministic Mindmeld gameplay E2E coverage for the multiplayer E2E roadmap.

**Architecture:** Exercise the real browser create/join/start room flow, then seed deterministic `mindmeld_rooms` state through the fake Supabase helper. Use real clue, team guess, reveal/next-round, and final-results UI actions to verify reducer wiring and cross-context realtime sync without depending on random puzzle/psychic selection.

**Tech Stack:** Next.js, React 19, TypeScript, Playwright, fake Supabase E2E server, pnpm.

---

## Progress

- [x] Repo updated to latest `origin/main` and fresh branch created: `feat/mindmeld-e2e-smoke`.
- [x] Write failing Mindmeld Playwright smoke spec.
- [x] Run targeted spec and confirm RED failure from missing selectors/coverage.
  - RED: `pnpm e2e -- e2e/games/mindmeld.spec.ts` failed on missing `mindmeld-status` selector.
- [x] Add stable Mindmeld E2E selectors to semantic UI surfaces.
- [x] Run targeted Mindmeld spec and confirm GREEN.
  - GREEN: `pnpm e2e -- e2e/games/mindmeld.spec.ts` passed, 1/1.
- [x] Update global E2E roadmap progress.
- [x] Run verification gate.
  - Passed after `pnpm lint:fix`: `pnpm lint`, `pnpm test`, targeted Mindmeld/Codenames/CAH/Skribbl/Uno E2E specs, room-contract E2E, and `pnpm build`.
- [x] Commit, push, and open PR.
  - PR #119: https://github.com/kkulykk/library-games/pull/119

## Test Scope

Create `e2e/games/mindmeld.spec.ts` covering:

1. Host creates room and guest joins through shared helpers.
2. Host starts game to validate the real start path.
3. Spec seeds deterministic playing state where host is Psychic, target is known, and guest is guesser.
4. Host sees private target; guest sees hidden/waiting clue state.
5. Host submits a clue through the real UI.
6. Guest sees clue, adjusts shared dial guess, and locks guess through the real UI.
7. Both contexts see reveal with target, team guess, distance, and score increment.
8. Host advances to the next round and the guest becomes Psychic.
9. Spec seeds final reveal state and clicks results, verifying final leaderboard on both contexts.

## Files

- Create: `e2e/games/mindmeld.spec.ts`
- Modify: `src/games/mindmeld/MindmeldGame.tsx`
- Modify: `docs/plans/2026-04-24-playwright-e2e-multiplayer.md`
- Modify: this plan file

## Expected Selectors

Add only stable semantic selectors:

- `mindmeld-status`
- `mindmeld-leaderboard`
- `mindmeld-dial`
- `mindmeld-private-target`
- `mindmeld-waiting-clue`
- `mindmeld-current-clue`
- `mindmeld-clue-input`
- `mindmeld-send-clue`
- `mindmeld-guess-slider`
- `mindmeld-lock-guess`
- `mindmeld-reveal`
- `mindmeld-round-score`
- `mindmeld-next-round`
- `mindmeld-finished`
- `mindmeld-final-leaderboard`

## Verification Gate

Run from repo root:

```bash
pnpm lint && pnpm test && pnpm e2e -- e2e/games/mindmeld.spec.ts && pnpm e2e -- e2e/games/codenames.spec.ts && pnpm e2e -- e2e/games/cards-against-humanity.spec.ts && pnpm e2e -- e2e/games/skribbl.spec.ts && pnpm e2e -- e2e/games/uno.spec.ts && pnpm e2e -- e2e/multiplayer-room-contract.spec.ts && pnpm build
```

If this is too slow while iterating, run the targeted Mindmeld spec first, then the full gate before commit.
