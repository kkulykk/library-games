# Library Games

A collection of classic and modern browser games built with Next.js 15.

**Live:** https://kkulykk.github.io/library-games

## Games

| Game            | Category               | Status      |
| --------------- | ---------------------- | ----------- |
| 🟩 Wordle       | Puzzle / Word          | Live        |
| 💣 Minesweeper  | Puzzle / Classic       | Live        |
| 🔢 2048         | Puzzle / Numbers       | Live        |
| 🔲 Sudoku       | Puzzle / Numbers       | Live        |
| 🃏 Memory Pairs | Puzzle / Memory        | Live        |
| 🐍 Snake        | Arcade / Classic       | Live        |
| 🧱 Tetris       | Arcade / Classic       | Live        |
| 🏓 Breakout     | Arcade / Classic       | Live        |
| 🎨 Skribbl      | Multiplayer / Drawing  | Coming Soon |
| 🎴 Uno          | Multiplayer / Cards    | Coming Soon |
| ♟️ Chess        | Multiplayer / Strategy | Coming Soon |

## Tech Stack

- **Next.js 15** — App Router, static export (`output: 'export'`)
- **React 19** + TypeScript (strict)
- **Tailwind CSS 3** with CSS custom properties for theming
- **Jest 29** + Testing Library for unit tests

## Development

**Prerequisites:** [pnpm](https://pnpm.io)

```bash
pnpm install
pnpm dev        # http://localhost:3000/library-games
```

```bash
pnpm lint           # ESLint + Prettier check
pnpm lint:fix       # auto-fix lint & formatting
pnpm test           # run all tests
pnpm test:watch     # watch mode
pnpm test:coverage  # coverage report (≥80% required on logic files)
pnpm build          # static export → /out
```

## Architecture

Each game follows a strict separation:

```
src/games/<slug>/
  logic.ts          # Pure functions — all game state, no React
  logic.test.ts     # Jest unit tests (≥80% coverage required)
  <Name>Game.tsx    # 'use client' component — rendering + event wiring only
```

Game routes (`src/app/games/<slug>/page.tsx`) are server components that simply wrap the client component in `<GameLayout>`. All game metadata lives in `src/data/games.ts`.

## Adding a Game

1. Add an entry to `src/data/games.ts` with all `GameMeta` fields
2. Implement pure logic in `src/games/<slug>/logic.ts`
3. Write tests in `src/games/<slug>/logic.test.ts`
4. Build the UI in `src/games/<slug>/<Name>Game.tsx` (`'use client'`)
5. Create the route at `src/app/games/<slug>/page.tsx`

See [CLAUDE.md](./CLAUDE.md) for detailed contributor guidance.
