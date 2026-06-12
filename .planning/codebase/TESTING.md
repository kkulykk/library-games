# Testing

**Analysis Date:** 2026-06-12

## Frameworks

| Layer             | Tool                        | Version | Config                     |
| ----------------- | --------------------------- | ------- | -------------------------- |
| Unit / component  | Jest                        | ^30.4.2 | `jest.config.js`           |
| DOM environment   | jest-environment-jsdom      | ^30.4.1 | `testEnvironment: 'jsdom'` |
| Component testing | @testing-library/react      | ^16.0.1 | —                          |
| User interaction  | @testing-library/user-event | ^14.5.2 | —                          |
| DOM matchers      | @testing-library/jest-dom   | ^6.6.3  | loaded in `jest.setup.ts`  |
| End-to-end        | @playwright/test            | ^1.60.0 | `playwright.config.ts`     |

Jest is wired through `next/jest.js` (`createJestConfig`) so it inherits the Next.js SWC transform, the `@/` → `src/` module alias, and CSS handling. **`jest.config.js` must remain `.js`** — `ts-node` is not installed, so a `.ts` config would fail.

## Commands

```bash
pnpm test            # jest --config jest.config.js (all unit/component tests)
pnpm test:watch      # jest --watch
pnpm test:coverage   # jest --coverage (enforces thresholds)
pnpm test -- src/games/wordle/logic.test.ts   # single file

pnpm e2e             # playwright test
pnpm e2e:ui          # playwright test --ui
pnpm e2e:debug       # playwright test --debug
pnpm e2e:ci          # playwright test --reporter=github,line
```

## Test Organization

**Co-located unit/component tests.** Tests live next to the code they cover, not in a separate tree:

- `src/games/<slug>/logic.test.ts` — pure reducer tests (every game has one).
- `src/games/<slug>/schema.test.ts` — Zod schema tests (most multiplayer games).
- `src/components/multiplayer/*.test.tsx` — React Testing Library component tests.
- `src/hooks/useInviteCode.test.ts` — hook tests.

`testMatch` picks up `**/?(*.)+(spec|test).[jt]s?(x)` and `**/__tests__/**`. The `e2e/` directory is excluded from Jest via `testPathIgnorePatterns: ['<rootDir>/e2e/']` so Playwright specs never run under Jest.

**Separate E2E tree.** Playwright tests live under `e2e/` with a Page Object Model:

```
e2e/
├── games/<slug>.spec.ts          # per-game E2E flows
├── pages/<Name>Page.ts           # page objects (UnoPage, CodenamesPage, …)
├── helpers/                      # navigation, players, fakeSupabase
├── fake-supabase/server.mjs      # standalone fake backend
├── multiplayer-room-contract.spec.ts
├── race-conditions.spec.ts
└── home.spec.ts
```

## Coverage Policy

Coverage is collected **only from pure logic**, where determinism makes high coverage meaningful:

```js
collectCoverageFrom: ['src/games/**/logic.ts']
coverageThreshold:
  global:                 { lines: 80, functions: 80, branches: 80, statements: 80 }
  'src/games/**/logic.ts':{ lines: 80 }
coverageProvider: 'v8'
```

The ≥80% threshold is a hard gate — `pnpm test:coverage` fails the build below it. React components and hooks are intentionally outside the coverage net; they are exercised by RTL component tests and Playwright E2E instead of being held to a line target.

## What Gets Tested Where

| Concern                        | Where                                   | How                                                      |
| ------------------------------ | --------------------------------------- | -------------------------------------------------------- |
| Game rules / state transitions | `logic.test.ts`                         | Pure function calls, no mocks, deterministic             |
| Network payload shape          | `schema.test.ts`                        | Zod `parse`/`safeParse` against valid + invalid fixtures |
| Lobby / roster / results UI    | `components/multiplayer/*.test.tsx`     | RTL render + user-event                                  |
| Full multiplayer flow          | `e2e/games/*.spec.ts`                   | Playwright, two simulated players, fake Supabase         |
| Race / concurrency             | `e2e/race-conditions.spec.ts`           | Concurrent actions against version CAS                   |
| Room contract                  | `e2e/multiplayer-room-contract.spec.ts` | Cross-game lobby invariants                              |

## Mocking & Test Doubles

- **Fake Supabase** is the primary test double, not a mock library. `src/lib/e2e/fake-supabase.ts` is an in-memory drop-in selected at runtime by `NEXT_PUBLIC_E2E_FAKE_SUPABASE=1` (see `src/lib/supabase.ts:34`). This lets multiplayer hooks run unchanged against an in-process backend.
- **E2E fake server** — `e2e/fake-supabase/server.mjs` runs as a standalone HTTP server (port 54321) that Playwright boots via `webServer`. It holds a single shared state and resets before each test.
- Because the fake server is single-stateful, Playwright runs **serially** (`fullyParallel: false`, `workers: 1`) to avoid resets racing in-flight tests.
- Jest setup: `jest.setup.ts` registers `@testing-library/jest-dom` matchers globally.

## Conventions & Patterns

- **Reducers are tested as data, not behavior** — call `applyAction(state, action)` and assert on the returned state. No spies, no timers in the pure path.
- **Invalid-input tests** for schemas assert that bad payloads are rejected (mirrors the runtime `safeParse` guard in `useGameRoom`).
- **Two-player E2E** uses helper factories in `e2e/helpers/players.ts` and page objects to drive create-room → join → play → results.

## Gaps & Notes

- `src/games/codenames/` and `src/games/mindmeld/` have a `schema.ts` but **no `schema.test.ts`** — schema validation for these two games is untested at the unit level (though covered indirectly by E2E).
- Coverage thresholds apply to logic only; a regression in a `*Game.tsx` renderer or in `useGameRoom.ts` would not be caught by the coverage gate — only by component/E2E tests.

## CI Integration

- Unit tests + lint run on every push and PR (`.github/workflows/ci.yml`, `lint-and-test` job). The lint/test step is never skipped.
- E2E (`e2e:ci`) uses the GitHub reporter and enables `retries: 1` and `forbidOnly` under CI.
