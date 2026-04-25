# Playwright E2E Testing for Multiplayer Games Implementation Plan

> **For Hermes:** Execute this plan only after Roman approves it. When executing, use the `subagent-driven-development` skill task-by-task.

**Goal:** Add deterministic Playwright E2E coverage focused on online multiplayer games so broken room flows, realtime sync bugs, role-specific UI bugs, race conditions, and game-specific corner cases are caught before deploy.

**Architecture:** Introduce Playwright as a browser-level test layer for the Next.js app. Use a deterministic E2E Supabase fake in test mode instead of the real Supabase project, because real realtime tests are slow, flaky, and will occasionally gaslight us. Drive multiple browser contexts per test to represent different players in the same room.

**Tech Stack:** Next.js static app, React 19, TypeScript, pnpm, Playwright, existing Jest unit tests, optional in-browser fake Supabase adapter gated by `NEXT_PUBLIC_E2E_FAKE_SUPABASE=1`.

---

## Current Findings

- App root: `/home/roman/repos/library-games`
- Package manager: `pnpm` (`pnpm-lock.yaml` exists)
- Current scripts: `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `test:coverage`
- App routing uses `basePath: '/library-games'` in `next.config.ts`
- Multiplayer games marked live in `src/data/games.ts`:
  - `skribbl`
  - `uno`
  - `agario` (display title: Slither.io)
  - `cards-against-humanity`
  - `codenames`
  - `mindmeld`
- Shared multiplayer room layer: `src/hooks/useGameRoom.ts`
- Supabase singleton: `src/lib/supabase.ts`
- Existing shared multiplayer UI components live in `src/components/multiplayer/`

## Success Criteria

- `pnpm e2e` runs Playwright tests locally against a dev server.
- `pnpm e2e:ci` runs headless in CI and stores traces/screenshots/videos only on failure.
- Tests can simulate 2-4 players with isolated browser contexts.
- Multiplayer room create/join/leave/restore flows are covered once in shared tests and reused for every online game where possible.
- Game-specific smoke paths exist for all live online multiplayer games.
- At least one high-value full gameplay path exists for Uno and Skribbl first, because those are most likely to expose turn/state/realtime bugs.
- Tests are deterministic and do not depend on the real hosted Supabase project.
- E2E failures produce enough artifacts to debug without rerunning six times like a raccoon with a laptop.

---

## Progress

**Branch:** `feat/playwright-multiplayer-e2e`

**Last updated:** 2026-04-25 09:30 UTC

**Completed:**

- [x] Task 1 — Installed Playwright (`@playwright/test`) and Chromium.
- [x] Task 2 — Added `playwright.config.ts` for Chromium, `/library-games` base URL, dev server startup, CI retries, and trace/screenshot/video artifacts.
- [x] Task 3 — Added `pnpm e2e`, `pnpm e2e:ui`, `pnpm e2e:debug`, and `pnpm e2e:ci` scripts.
- [x] Task 4 — Added stable `data-testid` selectors for shared multiplayer create/join/lobby flows across Uno, Skribbl, Agario, Cards Against Humanity, Codenames, and Mindmeld.
- [x] CI fix — Updated Jest config so Jest ignores Playwright E2E specs under `e2e/`.
- [x] Task 5 — Added reusable E2E helper modules for player contexts, game navigation, room create/join, roster assertions, room-code parsing, and start-game interactions.
- [x] Task 6 — Added injectable Supabase boundary and browser-side fake Supabase client backed by a local HTTP server.
- [x] Task 7 — Added fake Supabase reset endpoint plus Playwright reset helper/fixture.
- [x] Task 8 — Added shared room-create contract spec covering Skribbl, Uno, Agario, Cards Against Humanity, Codenames, and Mindmeld.
- [x] Task 9 — Extended shared room contract spec with cross-context join flow assertions across all live multiplayer slugs.
- [x] Task 10 — Added edge-state room contract coverage (invalid code, started-game join rejection, room-full rejection, leave/session-clear, reload restore path, expired/malformed session handling).
- [x] Task 11 — Added deterministic Uno full-turn smoke coverage for start-game UI, synced hands/piles/status, turn advancement, near-win seeding, and final-card win screens on both player contexts.
- [x] Security fix — Sanitized fake Supabase 500 responses so server exception details are logged locally but not returned over HTTP.

**Verification passed:**

- `pnpm lint`
- `pnpm test`
- `pnpm test:coverage`
- `pnpm e2e --list`
- `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts`
- `pnpm e2e -- e2e/games/uno.spec.ts`
- `pnpm build`

**Notes:**

- Added `e2e/playwright-setup.spec.ts` as a skipped placeholder so Playwright config/list commands succeed before real E2E specs are added.
- Added `/playwright-report/` and `/test-results/` to `.gitignore`.
- Mindmeld currently exposes `data-testid="room-code"` on text formatted as `Room ABCD`; future helpers should parse the 4-character code or this can be normalized in Task 5.
- Root cause of the failed CI run was Jest collecting `e2e/playwright-setup.spec.ts`; `jest.config.js` now ignores `<rootDir>/e2e/`.
- ESLint now ignores generated coverage and Playwright artifact directories.
- Playwright now starts both the fake Supabase server and the Next dev server for E2E runs.
- Codenames lobby now surfaces unassigned players in the roster so hosts are visible before choosing a team/role.
- Uno now has stable game-state E2E selectors for current status, draw pile, discard pile, and winner banner.
- Task 11 seeds deterministic fake Supabase Uno states after exercising the real create/join/start flow, avoiding random deck assumptions while still testing realtime UI sync.
- GitHub Advanced Security flagged fake Supabase error responses for information exposure; 500 responses are now generic while details stay in server logs.

**Next:** Task 12 — Skribbl round smoke test.

---

## Stage 1 — Playwright Baseline

### Task 1: Install Playwright

**Objective:** Add Playwright dependencies and browser install support.

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Steps:**

1. Run: `pnpm add -D @playwright/test`
2. Run: `pnpm exec playwright install chromium`
3. Verify: `pnpm exec playwright --version`

**Expected:** Playwright CLI works and Chromium is installed.

### Task 2: Add Playwright config

**Objective:** Configure Playwright for the Next app and `/library-games` base path.

**Files:**

- Create: `playwright.config.ts`

**Implementation notes:**

- Use `testDir: './e2e'`.
- Use Chromium first. Add Firefox/WebKit later only after the suite is stable.
- Use `baseURL: 'http://127.0.0.1:3000/library-games'`.
- Start app via Playwright `webServer` using `pnpm dev --hostname 127.0.0.1 --port 3000`.
- Set env:
  - `NEXT_PUBLIC_E2E_FAKE_SUPABASE=1`
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon-key`
- Enable retries in CI only.
- Enable trace/screenshot/video on first retry or failure.

**Verification:**

- Run: `pnpm exec playwright test --list`
- Expected: command succeeds, even before tests exist.

### Task 3: Add npm scripts

**Objective:** Make E2E commands discoverable.

**Files:**

- Modify: `package.json`

**Add scripts:**

- `e2e`: `playwright test`
- `e2e:ui`: `playwright test --ui`
- `e2e:debug`: `playwright test --debug`
- `e2e:ci`: `playwright test --reporter=github,line`

**Verification:**

- Run: `pnpm e2e --list`
- Expected: Playwright lists tests once tests are added; no config crash.

---

## Stage 2 — Stable Selectors and Test Harness

### Task 4: Add a minimal E2E selector convention

**Objective:** Avoid brittle tests tied to CSS classes or marketing copy.

**Files:**

- Modify as needed in:
  - `src/components/multiplayer/RoomInviteCard.tsx`
  - `src/components/multiplayer/PlayerRoster.tsx`
  - `src/components/multiplayer/LobbyActions.tsx`
  - Multiplayer game components under `src/games/*/*Game.tsx`

**Convention:**

- Add `data-testid` only for stable interaction/observation points.
- Prefer accessible role/name locators first, `data-testid` second.
- Prefix game-specific IDs with the slug:
  - `uno-hand-card`
  - `skribbl-canvas`
  - `cah-submit-card`
- Shared IDs:
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

**Verification:**

- Run: `pnpm lint`
- Expected: no lint/prettier errors.

### Task 5: Create E2E helpers

**Objective:** Provide reusable primitives for multi-player tests.

**Files:**

- Create: `e2e/helpers/players.ts`
- Create: `e2e/helpers/navigation.ts`
- Create: `e2e/helpers/assertions.ts`

**Helpers to implement:**

- `createPlayer(browser, name)` — returns isolated `BrowserContext` + `Page`.
- `gotoGame(page, slug)` — navigates to `/games/${slug}` under the configured baseURL.
- `createRoom(page, playerName)` — fills name, creates room, returns room code.
- `joinRoom(page, roomCode, playerName)` — joins existing room.
- `expectPlayerVisible(page, playerName)` — asserts roster contains player.
- `startGame(page)` — clicks start and waits for lobby to disappear.
- `closePlayers(players)` — always closes contexts.

**Verification:**

- Helpers type-check under Playwright tests.

---

## Stage 3 — Deterministic Supabase Fake

### Task 6: Add injectable Supabase client boundary

**Objective:** Let tests swap the real Supabase client with a deterministic fake.

**Files:**

- Modify: `src/lib/supabase.ts`
- Create: `src/lib/e2e/fake-supabase.ts`

**Approach:**

- Keep production behavior unchanged.
- If `process.env.NEXT_PUBLIC_E2E_FAKE_SUPABASE === '1'`, export a fake client instead of `createClient(...)`.
- The fake client must implement only the subset used by `useGameRoom.ts`:
  - `from(table).insert(...).select(...)`
  - `from(table).select(...).eq(...).single()`
  - `from(table).update(...).eq(...).eq(...).select(...)`
  - `channel(name).on(...).subscribe(...)`
  - `channel(name).send(...)`
  - `channel(name).track(...)`
  - `channel(name).presenceState()`
  - `channel(name).unsubscribe()`

**Important:** The fake must be shared across browser contexts. A per-page fake is useless for multiplayer tests. Use one of these designs:

1. Preferred: lightweight Node fake server launched by Playwright, with browser client communicating over WebSocket or `BroadcastChannel` bridge.
2. Simpler first pass: same-browser-context multi-page fake for shared-flow tests, then upgrade to cross-context fake before claiming full multiplayer coverage.

**Recommendation:** Implement the Node fake server now. It avoids designing around a lie.

**Verification:**

- Unit-test fake state updates if practical.
- Run one temporary Playwright test where Player A creates a room and Player B joins from a separate browser context.

### Task 7: Add fake backend reset hook

**Objective:** Ensure each test starts with empty rooms/presence/broadcasts.

**Files:**

- Modify: `playwright.config.ts`
- Create/modify: `e2e/helpers/fakeSupabase.ts`

**Approach:**

- Expose a reset endpoint or test fixture method for the fake server.
- Call reset in `test.beforeEach`.
- Use deterministic room code generation in fake/test mode where possible, or read the created code from UI.

**Verification:**

- Run a test twice in a row.
- Expected: no leaked rooms, players, presence, or localStorage state.

---

## Stage 4 — Shared Multiplayer Room Contract Tests

### Task 8: Create room contract spec

**Objective:** Verify every live online multiplayer game can create a room.

**Files:**

- Create: `e2e/multiplayer-room-contract.spec.ts`

**Coverage:**
For each slug in `['skribbl', 'uno', 'agario', 'cards-against-humanity', 'codenames', 'mindmeld']`:

1. Navigate to game.
2. Open create flow.
3. Enter host name.
4. Create room.
5. Assert room code is visible and length is 4.
6. Assert host appears in roster.
7. Assert invite link includes `/library-games/games/${slug}?code=`.

**Verification:**

- Run: `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts`
- Expected: all live multiplayer games pass.

### Task 9: Join room contract spec

**Objective:** Verify a second player can join every live online multiplayer game.

**Files:**

- Modify: `e2e/multiplayer-room-contract.spec.ts`

**Coverage:**
For each live online slug:

1. Host creates room in Player A context.
2. Player B opens same game.
3. Player B joins with room code.
4. Assert both players see both names.
5. Assert host remains host if host-only UI exists.

**Verification:**

- Run: `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts`
- Expected: no join failures or lost player rows.

### Task 10: Error and edge room states

**Objective:** Catch broken unhappy paths.

**Files:**

- Modify: `e2e/multiplayer-room-contract.spec.ts`

**Coverage:**

- Invalid room code shows `Room not found. Check the code and try again.`
- Joining a started game shows `This game has already started.`
- Full room shows `Room is full.` where max players are enforced.
- Leave room returns player to entry screen and clears session.
- Reload restores valid saved session.
- Expired/missing saved session is ignored.

**Verification:**

- Run: `pnpm e2e -- e2e/multiplayer-room-contract.spec.ts`
- Expected: clear deterministic pass/fail.

---

## Stage 5 — Priority Game-Specific E2E

### Task 11: Uno full turn smoke test

**Objective:** Catch turn order, playable-card, draw-card, and win-state bugs.

**Files:**

- Create: `e2e/games/uno.spec.ts`

**Coverage:**

1. Host creates room.
2. Second player joins.
3. Host starts game.
4. Assert both players see their hands and discard pile.
5. Current player either plays a valid card or draws.
6. Assert turn advances/same-turn behavior matches Uno rules.
7. Force/seed a near-win state in fake backend.
8. Player plays final card.
9. Assert winner/end screen appears on all pages.

**Verification:**

- Run: `pnpm e2e -- e2e/games/uno.spec.ts`
- Expected: deterministic pass.

### Task 12: Skribbl round smoke test

**Objective:** Catch drawer/guesser role bugs, canvas broadcast bugs, chat guess scoring, timer/round transitions.

**Files:**

- Create: `e2e/games/skribbl.spec.ts`

**Coverage:**

1. Create 3 players.
2. Host starts game.
3. Drawer sees word choices.
4. Drawer picks a word.
5. Drawer draws on canvas.
6. Guessers receive drawing strokes.
7. One guesser submits wrong guess; chat shows it but no score.
8. One guesser submits correct guess; score updates.
9. Force timer/round transition through fake backend.
10. Assert next drawer rotates.

**Verification:**

- Run: `pnpm e2e -- e2e/games/skribbl.spec.ts`
- Expected: deterministic pass.

### Task 13: Cards Against Humanity smoke test

**Objective:** Catch card czar rotation, submission, reveal, winner selection, and scoring bugs.

**Files:**

- Create: `e2e/games/cards-against-humanity.spec.ts`

**Coverage:**

1. Create 4 players.
2. Start game.
3. Non-czar players submit white cards.
4. Czar cannot submit as player.
5. Czar sees anonymized submissions.
6. Czar picks winner.
7. Score increments and next czar rotates.

**Verification:**

- Run: `pnpm e2e -- e2e/games/cards-against-humanity.spec.ts`

### Task 14: Codenames smoke test

**Objective:** Catch team/role setup, clue flow, guesses, assassin, and win conditions.

**Files:**

- Create: `e2e/games/codenames.spec.ts`

**Coverage:**

1. Create 4 players.
2. Assign/choose teams and spymasters.
3. Start game.
4. Spymaster sees board key; operative does not.
5. Spymaster submits clue.
6. Operative guesses a correct card.
7. Guessing assassin ends game.

**Verification:**

- Run: `pnpm e2e -- e2e/games/codenames.spec.ts`

### Task 15: Mindmeld smoke test

**Objective:** Catch psychic role, hidden target visibility, clue submission, guesses, scoring, rotation.

**Files:**

- Create: `e2e/games/mindmeld.spec.ts`

**Coverage:**

1. Create 3 players.
2. Start game.
3. Psychic sees hidden target; guessers do not.
4. Psychic submits clue.
5. Guessers move slider and lock guesses.
6. Round reveals target and scores players.
7. Next round rotates psychic.

**Verification:**

- Run: `pnpm e2e -- e2e/games/mindmeld.spec.ts`

### Task 16: Agario/Slither.io smoke test

**Objective:** Catch realtime movement, presence, collision/death, and leaderboard bugs.

**Files:**

- Create: `e2e/games/agario.spec.ts`

**Coverage:**

1. Create/join two players.
2. Start/enter arena.
3. Simulate movement from both contexts.
4. Assert each player sees the other entity.
5. Force collision/food pickup via fake backend or deterministic seed.
6. Assert length/score/leaderboard updates.

**Verification:**

- Run: `pnpm e2e -- e2e/games/agario.spec.ts`

---

## Stage 6 — Race Conditions and Regression Traps

### Task 17: Concurrent join conflict test

**Objective:** Catch version-conflict bugs in `useGameRoom.joinRoom`.

**Files:**

- Create: `e2e/race-conditions.spec.ts`

**Coverage:**

1. Host creates room.
2. Two players attempt to join at nearly the same time.
3. Assert the final room state contains host + both joiners or exactly one controlled failure with a retryable error.
4. Assert no player overwrites another player in state.

**Why:** `useGameRoom.ts` uses optimistic version updates. This is exactly where multiplayer apps like to eat players.

### Task 18: Concurrent action conflict test

**Objective:** Catch lost updates when two players dispatch actions at the same time.

**Files:**

- Modify: `e2e/race-conditions.spec.ts`

**Coverage:**

- Pick a low-complexity game action, likely chat/guess/submission.
- Fire actions from two contexts simultaneously.
- Assert both accepted actions are represented or the rejected one surfaces a useful retry/error state.

### Task 19: Reconnect/reload resilience test

**Objective:** Catch stale localStorage/session/room subscription bugs.

**Files:**

- Modify: `e2e/race-conditions.spec.ts`

**Coverage:**

1. Player joins room.
2. Reload page.
3. Restore session.
4. Other player performs action.
5. Reloaded player receives state update.
6. Player leaves; refresh should not rejoin automatically.

---

## Stage 7 — CI Integration

### Task 20: Add E2E job to GitHub Actions

**Objective:** Run Playwright in CI after lint/Jest tests.

**Files:**

- Modify: `.github/workflows/ci.yml`

**Approach:**

- Install pnpm deps.
- Run `pnpm exec playwright install --with-deps chromium`.
- Run `pnpm e2e:ci`.
- Upload `playwright-report/` and `test-results/` on failure.

**Verification:**

- Run local equivalent:
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `pnpm e2e:ci`

### Task 21: Add documentation

**Objective:** Make the suite easy to run and extend.

**Files:**

- Modify: `README.md` or create `docs/e2e.md`

**Document:**

- Local commands.
- How fake Supabase works.
- How to add a game E2E spec.
- Selector conventions.
- Debugging traces via `pnpm exec playwright show-report`.

---

## Stage 8 — Execution Order Recommendation

Do not try to test all six multiplayer games in one giant PR. That’s how test suites become soup.

Recommended PR order:

1. **PR 1: Playwright infra + fake Supabase + one shared create/join room test**
   - Tasks 1-9, minimal version.
2. **PR 2: Room unhappy paths + session restore/leave**
   - Task 10 and reconnect basics from Task 19.
3. **PR 3: Uno full gameplay smoke**
   - Task 11.
4. **PR 4: Skribbl full round smoke**
   - Task 12.
5. **PR 5: Remaining multiplayer smoke specs**
   - Tasks 13-16.
6. **PR 6: Race-condition tests + CI hardening**
   - Tasks 17-21.

---

## Risks and Mitigations

- **Risk:** Real Supabase makes tests flaky.
  - **Mitigation:** Use deterministic fake in E2E mode; keep real Supabase for production/manual testing.

- **Risk:** Fake Supabase diverges from real Supabase behavior.
  - **Mitigation:** Implement only the used subset, document it, and keep a tiny optional manual smoke checklist for real hosted Supabase.

- **Risk:** UI selectors become noisy.
  - **Mitigation:** Add `data-testid` only at stable boundaries and prefer role/name locators elsewhere.

- **Risk:** Multiplayer flows require too many players and slow CI.
  - **Mitigation:** Contract tests cover every game; deep gameplay tests start with Uno/Skribbl; remaining games get lean smoke tests.

- **Risk:** Time-based games create nondeterminism.
  - **Mitigation:** Use seeded/fake backend controls for timers and direct state setup where necessary.

---

## Approval Checkpoint

Plan is ready for review.

After approval, start with Stage 1 and execute in the recommended PR order. Do not continue into broad game-specific coverage until the shared room contract tests and fake Supabase harness are stable.
