# Cleanup, Maintenance, and Robustness Roadmap

_Date researched: 2026-06-18_

Progress tracking: use
[`docs/plans/2026-06-18-maintenance-cleanup-action-tracker.md`](./2026-06-18-maintenance-cleanup-action-tracker.md)
as the living checklist for implementation status, owners, verification notes, and the next active
PRs.

## Executive summary

Library Games is a mature static Next.js arcade with a consistent pure-logic/client-UI game
split, strong Jest coverage expectations for game engines, a shared Supabase room hook for online
multiplayer, and Playwright coverage backed by a deterministic fake Supabase server. The main
maintenance risk is no longer architectural drift at the top level; it is accumulated complexity in
large client components, large style/data files, schema/migration drift for multiplayer, and a few
robustness gaps around runtime validation, tooling, and operational documentation.

Recommended cleanup sequence:

1. **Stabilize the maintenance baseline** by adding type-check and dependency-audit scripts to CI,
   documenting the canonical Supabase migration path, and adding lightweight architecture fitness
   checks.
2. **Reduce high-churn file size** by extracting presentational subcomponents and constants from
   the largest game components and CSS modules.
3. **Harden multiplayer operations** by consolidating room SQL/RPC generation, adding negative-path
   tests for RPC errors and malformed realtime payloads, and documenting room cleanup scheduling.
4. **Improve UI robustness and accessibility** with shared keyboard/focus patterns, reduced-motion
   support, and reusable canvas/game-loop lifecycle utilities.
5. **Institutionalize ongoing maintenance** through recurring dependency updates, coverage reports,
   visual snapshots, and an explicit owner checklist for each game.

## Research scope and evidence

The audit covered repository structure, package scripts, CI configuration, the contributor guide,
Next/Jest/Playwright configuration, the shared multiplayer hook, Supabase boundaries, SQL schema
files, TODO/suppression markers, and coarse file-size metrics.

Key observations:

- The project uses Next.js 16, React 19, TypeScript strict mode, Jest 30, Playwright, Tailwind 4, and
  Supabase. Core scripts exist for linting, testing, coverage, E2E, Supabase integration canaries,
  and static export builds.
- CI currently separates lint/prettier/test coverage, Playwright E2E, build, and GitHub Pages deploy.
- Game architecture is intentionally split into `logic.ts`, `logic.test.ts`, client game components,
  optional `schema.ts`, and optional `use<Name>Room.ts` adapters.
- The shared multiplayer engine already contains meaningful hardening: Zod validation of untrusted
  room states, RPC-based writes, optimistic concurrency retries, room tokens, session restore, and a
  visible desync state.
- The largest maintenance hotspots are `src/games/cards-against-humanity/cards.ts`, large CSS files,
  and large client components such as Skribbl, Agar.io, Uno, Cards Against Humanity, Mindmeld,
  Codenames, and the home poster component.
- There are very few TODO/FIXME markers. Remaining intentional suppressions include one
  `react-hooks/exhaustive-deps` disable in Agar.io and a couple test-only unused-variable disables.
- Multiple Supabase migration files coexist, including older secure-RLS and newer sealed-RLS flows,
  so deployment guidance should make the canonical path unambiguous.

## Current strengths to preserve

### Architecture and maintainability

- Keep the pure game-logic boundary: all rule transitions should remain in `logic.ts` and be covered
  by `logic.test.ts`.
- Keep `src/hooks/useGameRoom.ts` as the single multiplayer lifecycle implementation. Per-game room
  hooks should stay thin adapters rather than reimplementing create/join/restore/dispatch logic.
- Keep game metadata centralized in `src/data/games.ts` so the home catalog, implemented routes, and
  docs stay aligned.
- Keep the static-export constraints explicit: no API routes, server writes, or hosting assumptions
  that conflict with GitHub Pages.

### Testing and quality gates

- Jest coverage thresholds already target game logic files.
- Playwright tests cover room flows, race conditions, accessibility, smoke flows, and visual
  snapshots.
- E2E tests use a fake Supabase server, which keeps most multiplayer tests deterministic and avoids
  relying on live infrastructure.

### Security and data integrity

- Multiplayer state crossing the network is typed as `unknown` at the Supabase boundary and validated
  downstream.
- Room writes flow through RPCs instead of direct table mutation.
- RLS is designed to be sealed for direct anon table access, with rollback migration files available.

## Roadmap

### Phase 0 — Baseline and safety net (1-2 days)

Priority: **P0**. Do this before large refactors.

1. **Add a dedicated TypeScript check script.**
   - Add `"typecheck": "tsc --noEmit"` to `package.json`.
   - Run it in CI between lint and tests.
   - Rationale: ESLint and Next builds catch many issues, but a fast explicit type gate makes local
     and CI expectations clear.

2. **Add a dependency/audit command with documented expectations.**
   - Add a script such as `"audit": "pnpm audit --prod"` or document why audits are run outside CI.
   - Prefer a warning-only scheduled workflow if noisy transitive advisories become a problem.
   - Rationale: Dependabot is grouped, but security posture needs a repeatable check.

3. **Create an architecture fitness checklist.**
   - Document rules such as: no direct Supabase `.from(...).update/insert` in app code, no game logic
     in route wrappers, every online game has schema tests, and every playable route has an E2E smoke
     path.
   - Optionally automate with a small script that scans for high-risk patterns.

4. **Capture baseline metrics.**
   - Track counts of games, test files, E2E specs, largest files, coverage summary, lint status, and
     build status in a maintenance note.
   - Rationale: cleanup should reduce risk measurably rather than just moving code.

Acceptance criteria:

- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, and `pnpm build` are documented as the minimum
  pre-merge gate.
- CI includes the new type check or explicitly records why the build is the type gate.

### Phase 1 — High-churn file decomposition (3-5 days)

Priority: **P1**. Goal: reduce cognitive load without changing gameplay.

1. **Split large client components by responsibility.**
   - Start with `SkribblGame.tsx`, `AgarioGame.tsx`, `UnoGame.tsx`,
     `CardsAgainstHumanityGame.tsx`, `MindmeldGame.tsx`, and `CodenamesGame.tsx`.
   - Extract stable subcomponents: lobby panel, rules/help panel, scoreboard, player controls,
     canvas overlay, dialogs, and status banners.
   - Keep state orchestration in the existing game component until each extraction is covered by
     tests or E2E smoke coverage.

2. **Split large style modules into semantic sections.**
   - `UnoGame.module.css`, `SkribblGame.module.css`, and global arcade styles should be reviewed for
     reusable tokens, duplicated animations, and component-local rules that can move closer to the
     component.
   - Preserve Tailwind/global CSS conventions already used by the app.

3. **Move oversized static card/word data behind explicit domain modules.**
   - `cards.ts` is large by necessity, but it can expose smaller named decks/categories and a clear
     validation test to prevent accidental malformed card entries.
   - Avoid turning static data into dynamic fetches; the app must remain statically exportable.

4. **Normalize route wrappers.**
   - Ensure every route under `src/app/games/<slug>/page.tsx` remains a minimal server component that
     imports a client game and wraps it in `GameLayout`.

Acceptance criteria:

- No extracted component exceeds the previous parent complexity without a reason.
- All extracted pieces keep existing selectors used by Playwright.
- Unit tests and smoke E2E continue to pass.

### Phase 2 — Multiplayer robustness hardening (4-7 days)

Priority: **P1** for online-game reliability.

1. **Make Supabase schema/RPC generation less repetitive.**
   - The room tables share the same `code/state/version/updated_at` shape and trigger policy.
   - Create a documented SQL template or generator for new multiplayer games.
   - Mark the canonical migration path clearly: fresh schema, sealed-RLS migration, rollback, and any
     legacy migration files.

2. **Expand negative-path tests for `useGameRoom`.**
   - Add tests for malformed restore payloads, invalid RPC return versions, missing tokens,
     exhausted create-code collisions, broadcast channel failures, and stale forged wakeup messages.
   - Verify user-facing errors never leak raw database error messages.

3. **Add per-game schema fuzz/property checks where practical.**
   - For each online game schema, test that invalid phases, missing players, duplicate IDs, and
     out-of-range game-specific fields are rejected.
   - Keep this lightweight: table-driven Jest cases are enough.

4. **Document operational cleanup.**
   - The SQL comments mention deleting old rooms or scheduling `pg_cron`; create a docs page with the
     exact recommended job, retention policy, verification query, and rollback note.
   - Include guidance for fake Supabase versus real Supabase test runs.

5. **Review invite/session lifecycle behavior.**
   - Ensure 24-hour localStorage resume behavior is consistent across all online games.
   - Add tests for expired sessions, corrupt session JSON, and player-name normalization on restore.

Acceptance criteria:

- All online games have schema tests for both happy and hostile payloads.
- Room cleanup is documented with concrete SQL and verification steps.
- Direct table access is not used by application code except intentional fake/test boundaries.

### Phase 3 — UI robustness, accessibility, and lifecycle cleanup (4-6 days)

Priority: **P2**, but valuable before adding more games.

1. **Create shared keyboard and focus utilities.**
   - Many games rely on keyboard input. Standardize focus acquisition, key repeat handling,
     pause/resume behavior, and cleanup of global event listeners.
   - Include a reduced-motion path for animated/canvas-heavy games.

2. **Create shared game-loop/canvas helpers.**
   - Snake, Bounce, Breakout, Tetris, Agar.io, and Skribbl-like canvases should share lifecycle
     patterns: `requestAnimationFrame` cleanup, resize observers, DPR scaling, visibility pause, and
     deterministic test seams.

3. **Strengthen accessibility snapshots.**
   - Keep the existing Playwright accessibility spec and add coverage for modal dialogs, lobby forms,
     invite copy buttons, canvas alternatives/instructions, and keyboard-only start flows.

4. **Improve error-boundary coverage.**
   - Verify shared `ErrorBoundary` behavior with a focused test.
   - Ensure major routes fail gracefully when a client component throws.

Acceptance criteria:

- Keyboard controls are documented for every game.
- Canvas-heavy games clean up timers, animation frames, and listeners on unmount and tab-hide.
- Accessibility checks cover both home/catalog and representative single-player/multiplayer game
  states.

### Phase 4 — Tooling, dependency, and CI maintenance (2-4 days)

Priority: **P2**.

1. **Pin and document Node/pnpm expectations.**
   - CI uses Node 20 and pnpm 9; add `.nvmrc`, `engines`, or README guidance if contributors should
     match those versions locally.

2. **Revisit grouped Dependabot cadence.**
   - Grouping reduces PR noise, but major framework jumps can combine many unrelated failures.
   - Consider separate groups for Next/React, testing, Supabase, and lint/format tools if grouped PRs
     become hard to review.

3. **Add a scheduled non-deploy CI run.**
   - Weekly scheduled CI catches stale lockfiles, browser dependency issues, and future deprecations
     even when no PR is open.

4. **Cache and artifact hygiene.**
   - Keep Playwright artifacts on failure only, as today.
   - Add coverage artifact upload only when useful for review; avoid noise if reports are not read.

Acceptance criteria:

- Local setup versions match CI or are explicitly documented.
- Dependency update policy is clear for routine and emergency updates.

### Phase 5 — Game-by-game cleanup campaigns (ongoing)

Priority: **P3**, run one game at a time.

For each game, use this checklist:

1. Confirm route, metadata, rules, keyboard controls, and status are in sync.
2. Confirm pure logic functions have meaningful branch coverage, not only line coverage.
3. Confirm UI component cleanup on unmount, restart, and visibility changes.
4. Confirm selectors and page objects exist for E2E smoke coverage.
5. Confirm user-visible errors are actionable.
6. Confirm docs mention any unusual rules or multiplayer constraints.

Suggested order:

1. **Agar.io** — largest interactive canvas component and one hook-deps suppression.
2. **Skribbl** — large component and style module, realtime drawing/broadcast complexity.
3. **Uno** — large component/style module and complex game rules.
4. **Cards Against Humanity** — large static data and multiplayer judging flow.
5. **Home catalog** — large poster component and broad visual impact.
6. Remaining single-player games in batches.

## Risk register

| Risk                                                         | Impact | Mitigation                                                                           |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| Refactors break Playwright selectors                         | High   | Preserve `data-testid`/accessible names; update page objects only intentionally.     |
| Extracting UI accidentally moves game rules into React state | High   | Keep `logic.ts` as the only rules authority; add regression tests before extraction. |
| SQL files diverge from deployed Supabase state               | High   | Document canonical migration order and add verification queries.                     |
| Static export assumptions regress                            | Medium | Keep `pnpm build` in CI and avoid API routes/server writes.                          |
| Dependabot grouped PRs become too large                      | Medium | Split dependency groups by ecosystem area if review burden increases.                |
| Canvas games leak animation frames/listeners                 | Medium | Add shared lifecycle helper and unmount/visibility tests.                            |

## Proposed immediate next PRs

1. **Add typecheck and baseline docs.**
   - `package.json`: add `typecheck`.
   - `.github/workflows/ci.yml`: run it.
   - Docs: record required local checks.

2. **Document Supabase operations.**
   - Add `docs/supabase-operations.md` with migration order, sealed RLS verification, cleanup job,
     fake Supabase notes, and integration canary instructions.

3. **Extract Agar.io canvas lifecycle helpers.**
   - Remove the remaining production hook dependency suppression if possible.
   - Add focused tests around mount/unmount behavior.

4. **Add multiplayer hostile-payload tests.**
   - Start in `useGameRoom.test.ts`, then add schema table tests for each online game.

5. **Split one large game UI as a template.**
   - Use Uno or Skribbl as the example extraction pattern and document the approach.

## Definition of done for the maintenance program

- CI has explicit lint, format, typecheck, unit coverage, E2E, and build gates.
- Every online game has schema tests covering invalid hostile payloads.
- Supabase deployment and cleanup operations are documented and reproducible.
- Largest components are split into cohesive subcomponents without reducing test coverage.
- Canvas/game-loop lifecycle behavior is shared or consistently tested.
- Accessibility checks cover representative interactive and multiplayer states.
