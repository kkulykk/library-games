# Library Games

Library Games is a polished browser arcade built with Next.js. It mixes classic single-player games with real-time multiplayer party games, all shipped as a static site on GitHub Pages.

Live: https://kkulykk.github.io/library-games

## What’s in the app

- Discover + Library home experience
  - Discover: featured hero carousel, trending rail, quick plays, and multiplayer spotlight
  - Library: searchable/filterable catalog with sort controls and poster-grid browsing
- 18 total titles
  - 17 live
  - 11 single-player
  - 7 online multiplayer
  - 1 coming soon
- Real-time multiplayer rooms powered by Supabase
- Static export deployment via GitHub Pages

## Games

| Game                      | Category           | Status      |
| ------------------------- | ------------------ | ----------- |
| 🟩 Wordle                 | Single-player      | Live        |
| 💣 Minesweeper            | Single-player      | Live        |
| 🔢 2048                   | Single-player      | Live        |
| 🔲 Sudoku                 | Single-player      | Live        |
| 🃏 Memory Pairs           | Single-player      | Live        |
| 🐍 Snake                  | Single-player      | Live        |
| 🧱 Tetris                 | Single-player      | Live        |
| 🏓 Breakout               | Single-player      | Live        |
| 🪢 Hangman                | Single-player      | Live        |
| 🔴 Bounce                 | Single-player      | Live        |
| ⭕ Tic-Tac-Toe            | Single-player      | Live        |
| 🎨 Skribbl                | Online multiplayer | Live        |
| 🎴 Uno                    | Online multiplayer | Live        |
| 🐍 Slither.io             | Online multiplayer | Live        |
| 🃏 Cards Against Humanity | Online multiplayer | Live        |
| 🕵️ Codenames              | Online multiplayer | Live        |
| 🧠 Mindmeld               | Online multiplayer | Live        |
| ♟️ Chess                  | Online multiplayer | Coming Soon |

Source of truth for game metadata and status: `src/data/games.ts`.

## Tech stack

- Next.js 16 (App Router, static export)
- React 19
- TypeScript (strict mode)
- Tailwind CSS 4
- Jest 30 + Testing Library
- Supabase Realtime for multiplayer room sync

## Development

Prerequisite: `pnpm`

```bash
pnpm install
pnpm dev        # http://localhost:3000/library-games
```

```bash
pnpm lint           # ESLint + Prettier check
pnpm lint:fix       # auto-fix lint & formatting
pnpm test           # run all tests
pnpm test:watch     # watch mode
pnpm test:coverage  # coverage report (>=80% required on logic files)
pnpm build          # static export -> /out
```

## E2E testing

Playwright E2E tests cover multiplayer room flows, game smoke paths, race conditions, and reconnect behavior with a deterministic fake Supabase backend (`src/lib/e2e/`).

```bash
pnpm e2e        # run Playwright headless
pnpm e2e:ui     # open Playwright UI mode
pnpm e2e:debug  # run with Playwright debugger
pnpm e2e:ci     # CI reporter format
```

## Architecture

Each game follows a strict split between pure logic and UI:

```text
src/games/<slug>/
  logic.ts          # Pure functions — game state and rules
  logic.test.ts     # Jest unit tests
  <Name>Game.tsx    # 'use client' component — rendering + event wiring only
```

Important project structure:

- `src/app/page.tsx` — home route entry
- `src/components/home/` — Discover + Library home experience
- `src/data/games.ts` — source of truth for game metadata
- `src/games/<slug>/` — per-game logic and UI
- `src/app/games/<slug>/page.tsx` — route wrappers for implemented/playable games

## Online multiplayer

Online multiplayer games use Supabase as the real-time state bus.

- room state is stored in a single `jsonb` payload
- clients subscribe to updates with `postgres_changes`
- shared room orchestration lives in `src/hooks/useGameRoom.ts`, with per-game `use<Name>Room.ts` wrappers
- gameplay state transitions stay in pure `logic.ts` files

## Security model & trust boundaries

Online games are **client-authoritative**: there is no game server. The pure
reducer runs in every player's browser and writes the next state to Supabase,
which acts purely as a real-time state bus. Access is gated by a 6-char CSPRNG
room code plus a per-room write token, and every payload crossing the network is
Zod-validated before entering React state. The data layer is sealed — Row Level
Security is enabled with no permissive policies, and all access flows through
`SECURITY DEFINER` RPCs (`create`/`join`/`restore`/`dispatch`/`get`) that
validate the code, player names, and payload/roster size caps server-side.

Two properties are **accepted design limitations** for this threat model (a
friends arcade with no PII beyond self-chosen display names), not bugs:

- **Hidden information is visible to code-holders.** The entire game state —
  including hidden data like Uno/CAH hands, the Codenames key, or the Skribbl
  secret word — lives in one row that any code-holder can read via
  `get_<game>(code)` (or DevTools). **Competitive integrity is honor-system.**
  Closing this would require splitting state into public/per-player columns with
  token-gated reads, or server-side dealing — out of scope for a casual arcade.
- **The `room_token` is per-room, not per-player.** It is defense-in-depth for
  the write path (it protects against a leaked read-only view), **not player
  authentication.** Because player ids are readable via `get_<game>`, anyone with
  the room code can `restore` as any player and obtain the shared write token, so
  the room code is effectively the full write capability and members can act as
  one another.

See `SECURITY.md` for how to report issues. The full server-side rationale lives
in the generated `supabase/schema.sql` (generated from
`scripts/generate-schema.mjs`).

## Adding a game

1. Add the metadata entry in `src/data/games.ts`
2. Implement pure rules in `src/games/<slug>/logic.ts`
3. Add tests in `src/games/<slug>/logic.test.ts`
4. Build the client component in `src/games/<slug>/<Name>Game.tsx`
5. Create the route in `src/app/games/<slug>/page.tsx`

See `CLAUDE.md` for the fuller contributor guide and project constraints.
