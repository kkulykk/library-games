# Library Games

A collection of classic and modern browser games built with Next.js.

Live: https://kkulykk.github.io/library-games

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

Source of truth for metadata and status: `src/data/games.ts`.

## Tech Stack

- Next.js 16 (App Router, static export via `output: 'export'`)
- React 19 + TypeScript (strict)
- Tailwind CSS 4
- Jest 30 + Testing Library
- Supabase Realtime for online multiplayer rooms

## Development

Prerequisite: pnpm (or `corepack pnpm`)

```bash
corepack pnpm install
corepack pnpm dev        # http://localhost:3000/library-games
```

```bash
corepack pnpm lint           # ESLint + Prettier check
corepack pnpm lint:fix       # auto-fix lint & formatting
corepack pnpm test           # run all tests
corepack pnpm test:watch     # watch mode
corepack pnpm test:coverage  # coverage report (>=80% required on logic files)
corepack pnpm build          # static export -> /out
```

## Architecture

Each game follows a strict separation:

```text
src/games/<slug>/
  logic.ts          # Pure functions — all game state, no React
  logic.test.ts     # Jest unit tests
  <Name>Game.tsx    # 'use client' component — rendering + event wiring only
```

Game routes (`src/app/games/<slug>/page.tsx`) are server components that wrap client components in `GameLayout`. All game metadata lives in `src/data/games.ts`.

## Adding a Game

1. Add entry to `src/data/games.ts` (`GameMeta`)
2. Implement pure logic in `src/games/<slug>/logic.ts`
3. Write tests in `src/games/<slug>/logic.test.ts`
4. Build UI in `src/games/<slug>/<Name>Game.tsx` (`'use client'`)
5. Create route in `src/app/games/<slug>/page.tsx`

See `CLAUDE.md` for full contributor guidance.
