# E2E testing

Library Games uses Playwright for browser-level E2E coverage of multiplayer room flows, game smoke paths, race conditions, and reconnect behavior.

## Commands

```bash
pnpm e2e        # run Playwright headless
pnpm e2e:ui     # open Playwright UI mode
pnpm e2e:debug  # run with Playwright debugger
pnpm e2e:ci     # CI reporter format
```

Run a single spec:

```bash
pnpm e2e -- e2e/multiplayer-room-contract.spec.ts
pnpm e2e -- e2e/games/uno.spec.ts
pnpm e2e -- e2e/race-conditions.spec.ts
```

View the HTML report:

```bash
pnpm exec playwright show-report
```

## Fake Supabase

E2E tests do not use the hosted Supabase project.

Playwright starts a local fake Supabase server with:

```bash
node e2e/fake-supabase/server.mjs
```

The Next.js dev server is started with:

```bash
NEXT_PUBLIC_E2E_FAKE_SUPABASE=1
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon-key
```

When `NEXT_PUBLIC_E2E_FAKE_SUPABASE=1`, `src/lib/supabase.ts` exports the fake client from `src/lib/e2e/fake-supabase.ts` instead of the real Supabase client.

The fake backend is shared across browser contexts, so tests can model multiple players in the same room. Tests can also call helpers in `e2e/helpers/fakeSupabase.ts` to reset state or seed deterministic room state.

## Adding a game E2E spec

1. Add shared create/join coverage to `e2e/multiplayer-room-contract.spec.ts` when adding a new live multiplayer game.
2. Add game-specific smoke coverage in `e2e/games/<slug>.spec.ts`.
3. Drive flows through the Page Object Model:
   - Extend `RoomLobbyPage` from `e2e/pages/RoomLobbyPage.ts` to get create/join/start/leave actions for free.
   - Add a per-game POM at `e2e/pages/<Game>Page.ts` that exposes locators and high-level actions.
   - Re-export the new POM from `e2e/pages/index.ts`.
4. Use helpers from:
   - `e2e/helpers/players.ts` for multi-context players
   - `e2e/helpers/navigation.ts` for routing
   - `e2e/helpers/fakeSupabase.ts` for direct state seeding/reads
5. Start from the real UI flow where practical: create room, join room, start game.
6. Use fake Supabase direct state setup only for deterministic deep-game states that would be slow, random, or time-based to reach through the UI.
7. Assert both UI text _and_ the underlying fake-Supabase state at the end of a flow so a UI-only or state-only regression both fail.

## Selector conventions

Prefer accessible role/name locators when UI text is stable. Use `data-testid` only for stable interaction or observation points that should not depend on styling or marketing copy.

Shared test IDs:

- `play-game-button`
- `player-name-input`
- `room-code-input`
- `create-room-button`
- `join-room-button`
- `room-code`
- `invite-link`
- `player-roster`
- `start-game-button`
- `leave-room-button`
- `room-error`

Game-specific test IDs should be prefixed with the game slug, for example:

- `uno-hand-card`
- `skribbl-canvas`
- `cah-submit-card`
- `codenames-board-card`
- `mindmeld-guess-slider`
- `agario-canvas`

## CI artifacts and debugging

CI runs:

```bash
pnpm exec playwright install --with-deps chromium
pnpm e2e:ci
```

On failure, GitHub Actions uploads:

- `playwright-report/`
- `test-results/`

Download the artifacts from the failed workflow run and inspect them locally. If an HTML report is available, run:

```bash
pnpm exec playwright show-report
```

## Workflow push permission pitfall

Changing `.github/workflows/ci.yml` modifies a GitHub Actions workflow file. Automation credentials may need the GitHub `workflow` permission/scope to push the change. If a push is rejected for workflow scope, apply the same patch with a token/user that can update workflow files.
