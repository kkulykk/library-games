# Cleanup, Maintenance, and Robustness Action Tracker

_Created: 2026-06-18_

Source roadmap:
[`docs/plans/2026-06-18-maintenance-cleanup-roadmap.md`](./2026-06-18-maintenance-cleanup-roadmap.md)

This is the living tracker for the maintenance roadmap. Update it in every cleanup PR: move the
relevant item to `Active`, `Blocked`, or `Done`, add a dated progress note, and record the
verification command that proves the item is complete.

## Status Legend

- `Todo` - not started.
- `Active` - currently being worked.
- `Blocked` - cannot move without a decision, secret, external service, or prior task.
- `Partial` - meaningful groundwork exists, but the acceptance criteria are not complete.
- `Done` - merged or otherwise complete with verification recorded.

## Current Progress

| Area                            | Done | Partial | Active | Todo | Blocked |
| ------------------------------- | ---: | ------: | -----: | ---: | ------: |
| Phase 0: baseline safety        |    0 |       1 |      0 |    5 |       0 |
| Phase 1: high-churn files       |    0 |       0 |      0 |    5 |       0 |
| Phase 2: multiplayer hardening  |    0 |       1 |      0 |    6 |       0 |
| Phase 3: UI robustness          |    0 |       0 |      0 |    4 |       0 |
| Phase 4: tooling and CI         |    2 |       1 |      0 |    4 |       0 |
| Phase 5: game cleanup campaigns |    0 |       0 |      0 |    6 |       0 |

Overall: **2 Done, 3 Partial, 0 Active, 30 Todo, 0 Blocked**.

Baseline observed on 2026-06-18:

- 17 game routes under `src/app/games`.
- 17 game logic test files under `src/games`.
- 6 online-game schema test files under `src/games`.
- 11 Playwright spec files under `e2e`.
- Largest files by line count: `cards.ts` 2136, `UnoGame.module.css` 1693,
  `globals.css` 1643, `SkribblGame.tsx` 1588, `AgarioGame.tsx` 1571,
  `UnoGame.tsx` 1423, `SkribblGame.module.css` 1360.
- CI already has lint, Prettier, unit coverage, E2E, build, and deploy jobs.
- Missing explicit gates: `typecheck` script, CI typecheck step, documented audit command.

## Next PR Queue

1. `P0-01` + `P0-02` + `P0-05`: add `typecheck`, wire it into CI, and document the minimum
   local/CI gate.
2. `P0-03` + `P0-04`: add the audit command and architecture fitness checklist.
3. `P2-01` + `P2-04`: document canonical Supabase operations and resolve the current room-cleanup
   docs mismatch.
4. `P2-02`: add high-value negative-path tests to `useGameRoom.test.ts`.
5. `P3-02` + `P5-01`: extract Agar.io lifecycle helpers and use that cleanup as the first game
   campaign template.

## Phase 0 - Baseline And Safety Net

Priority: P0. Complete before large refactors.

| ID    | Status  | Action                            | Deliverable                                                                   | Verification                                      |
| ----- | ------- | --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| P0-01 | Todo    | Add explicit TypeScript gate      | Add `typecheck: tsc --noEmit` to `package.json`.                              | `pnpm typecheck`                                  |
| P0-02 | Todo    | Run typecheck in CI               | Add a CI step after Prettier and before coverage tests.                       | GitHub Actions lint-and-test job includes it.     |
| P0-03 | Todo    | Add dependency audit command      | Add `audit` script or document why audits are manual/warning-only.            | `pnpm audit` or documented replacement.           |
| P0-04 | Todo    | Create architecture checklist     | Add a checklist for Supabase writes, route wrappers, schema tests, smoke E2E. | Checklist exists and is linked from roadmap docs. |
| P0-05 | Todo    | Document minimum pre-merge gate   | README/guide names lint, typecheck, coverage, E2E, and build expectations.    | `pnpm lint`, `pnpm typecheck`, coverage, build.   |
| P0-06 | Partial | Capture baseline maintenance data | Static inventory captured above; command results still need a fresh run.      | Record dated lint, coverage, E2E, and build runs. |

Notes:

- 2026-06-18: CI has lint, Prettier, coverage, E2E, build, and deploy jobs, but no explicit
  `typecheck` or `audit` script.

## Phase 1 - High-Churn File Decomposition

Priority: P1. Reduce cognitive load without changing gameplay.

| ID    | Status | Action                           | Deliverable                                                                 | Verification                         |
| ----- | ------ | -------------------------------- | --------------------------------------------------------------------------- | ------------------------------------ |
| P1-01 | Todo   | Decompose `SkribblGame.tsx`      | Extract lobby, drawing surface, tools/status, and round panels.             | Existing Skribbl tests and E2E pass. |
| P1-02 | Todo   | Decompose `AgarioGame.tsx`       | Extract canvas lifecycle/presentation from room and input orchestration.    | Existing Agar.io tests and E2E pass. |
| P1-03 | Todo   | Decompose `UnoGame.tsx`          | Extract hand, discard pile, lobby/status, action controls, and dialogs.     | Existing Uno tests and E2E pass.     |
| P1-04 | Todo   | Decompose CAH/Mindmeld/Codenames | Extract stable panels without moving rule logic into React state.           | Targeted game tests and E2E pass.    |
| P1-05 | Todo   | Split large style/data modules   | Review Uno/Skribbl CSS, global arcade styles, and CAH card data boundaries. | `pnpm lint` and targeted tests pass. |

Guardrails:

- Preserve Playwright selectors and accessible names unless a page object is intentionally updated.
- Keep rules in `logic.ts`; React extractions should be presentational or wiring-only.

## Phase 2 - Multiplayer Robustness Hardening

Priority: P1 for online-game reliability.

| ID    | Status  | Action                              | Deliverable                                                                     | Verification                                      |
| ----- | ------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| P2-01 | Todo    | Document canonical Supabase path    | Add `docs/supabase-operations.md` with migration order and rollback guidance.   | Docs reviewed against current SQL files.          |
| P2-02 | Todo    | Expand `useGameRoom` negative tests | Cover malformed restore payloads, invalid versions, missing tokens, RPC errors. | `pnpm test -- src/hooks/useGameRoom.test.ts`      |
| P2-03 | Partial | Strengthen per-game schema tests    | All six online games have schema tests; hostile payload breadth needs review.   | Run each `schema.test.ts` file.                   |
| P2-04 | Todo    | Document room cleanup operations    | Exact `pg_cron` job, retention, verification query, and rollback note.          | Docs include executable SQL and verification SQL. |
| P2-05 | Todo    | Review invite/session lifecycle     | Tests for expired sessions, corrupt session JSON, and name normalization.       | Hook tests cover restore edge cases.              |
| P2-06 | Todo    | Add SQL template or generator       | Reusable pattern for room table/RPC creation for future games.                  | New online-game checklist references it.          |
| P2-07 | Todo    | Scan for direct table writes        | Confirm production app code only writes via RPCs.                               | Script/checklist result recorded.                 |

Notes:

- 2026-06-18: `AGENTS.md` says rooms auto-delete via `pg_cron`, while `CLAUDE.md` says the cleanup
  job must be scheduled manually. `P2-04` should resolve this into one canonical operations doc.

## Phase 3 - UI Robustness, Accessibility, And Lifecycle Cleanup

Priority: P2.

| ID    | Status | Action                          | Deliverable                                                               | Verification                                          |
| ----- | ------ | ------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| P3-01 | Todo   | Create keyboard/focus utilities | Shared focus acquisition, key repeat, pause/resume, and listener cleanup. | Unit tests plus representative game smoke tests.      |
| P3-02 | Todo   | Create canvas/game-loop helpers | Shared RAF cleanup, resize/DPR handling, visibility pause, test seams.    | Canvas games prove unmount and visibility cleanup.    |
| P3-03 | Todo   | Strengthen accessibility E2E    | Add modal, lobby form, invite button, canvas alternative, keyboard flows. | Targeted Playwright accessibility checks pass.        |
| P3-04 | Todo   | Test error boundaries           | Focused tests for `ErrorBoundary` and graceful route failure behavior.    | `pnpm test -- src/components/ErrorBoundary.test.tsx`. |

## Phase 4 - Tooling, Dependency, And CI Maintenance

Priority: P2.

| ID    | Status  | Action                            | Deliverable                                                               | Verification                                  |
| ----- | ------- | --------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| P4-01 | Todo    | Pin local Node/pnpm expectations  | Add `.nvmrc`, `engines`, README guidance, or equivalent local setup docs. | Local setup docs match CI Node 20 and pnpm 9. |
| P4-02 | Done    | Keep Dependabot grouped baseline  | Weekly npm and GitHub Actions groups already exist.                       | `.github/dependabot.yml` checked.             |
| P4-03 | Todo    | Revisit Dependabot split policy   | Decide whether Next/React, testing, Supabase, and lint tools need groups. | Policy documented in Dependabot plan/docs.    |
| P4-04 | Todo    | Add scheduled non-deploy CI       | Weekly schedule for lint/test/E2E/build without deploy.                   | `.github/workflows/ci.yml` has schedule.      |
| P4-05 | Done    | Keep Playwright artifacts focused | CI uploads `playwright-report` and `test-results` only on failure.        | `.github/workflows/ci.yml` checked.           |
| P4-06 | Partial | Maintain E2E CI coverage          | E2E job exists; future work should keep it stable and documented.         | `pnpm e2e:ci` and CI job pass.                |
| P4-07 | Todo    | Decide coverage artifact policy   | Add upload only if reports are read during review; otherwise document no. | Policy documented.                            |

## Phase 5 - Game-By-Game Cleanup Campaigns

Priority: P3. Run one game at a time.

Per-game checklist:

- Route, metadata, rules, keyboard controls, and status are in sync.
- Pure logic functions have meaningful branch coverage.
- UI cleans up timers, animation frames, observers, and listeners on unmount/restart/tab-hide.
- E2E selectors and page objects cover a smoke path.
- User-visible errors are actionable.
- Docs mention unusual rules or multiplayer constraints.

| ID    | Status | Campaign                      | First pass scope                                                            | Verification                            |
| ----- | ------ | ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------- |
| P5-01 | Todo   | Agar.io                       | Canvas lifecycle, hook-deps suppression, multiplayer recovery paths.        | Agar.io tests, E2E, lint.               |
| P5-02 | Todo   | Skribbl                       | Drawing lifecycle, broadcast handling, CSS decomposition.                   | Skribbl tests, E2E, lint.               |
| P5-03 | Todo   | Uno                           | Component/CSS decomposition and complex rules regression coverage.          | Uno tests, E2E, lint.                   |
| P5-04 | Todo   | Cards Against Humanity        | Static data validation, judging flow clarity, multiplayer hostile payloads. | CAH tests, schema tests, E2E, lint.     |
| P5-05 | Todo   | Home catalog                  | Poster component size, visual impact, catalog accessibility and filtering.  | Home E2E, lint, visual review.          |
| P5-06 | Todo   | Remaining single-player games | Batch cleanup for routes, controls, cleanup behavior, and branch coverage.  | Single-player E2E, targeted unit tests. |

## Completion Criteria

The maintenance program is complete when all of these are true:

- CI has explicit lint, format, typecheck, unit coverage, E2E, and build gates.
- Every online game has schema tests covering invalid hostile payloads.
- Supabase deployment and cleanup operations are documented and reproducible.
- Largest components are split into cohesive subcomponents without reducing coverage.
- Canvas/game-loop lifecycle behavior is shared or consistently tested.
- Accessibility checks cover representative interactive and multiplayer states.

## Progress Notes

- 2026-06-18: Created tracker from the roadmap and recorded initial repo-observed status.
