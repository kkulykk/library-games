# Directory Structure

**Analysis Date:** 2026-06-12

## Top-Level Layout

```
library-games/
├── src/                      # All application source
│   ├── app/                  # Next.js App Router (routes + layout)
│   ├── components/           # Shared React components
│   ├── data/                 # Game registry + word lists
│   ├── games/                # Per-game vertical slices (logic + UI + hooks)
│   ├── hooks/                # Cross-game React hooks
│   └── lib/                  # Infrastructure helpers (supabase, utils)
├── e2e/                      # Playwright end-to-end tests + fake backend
├── public/                   # Static assets (served under basePath)
├── supabase-schema.sql       # Postgres schema for multiplayer rooms
├── .env.local.example        # Template for Supabase env vars
├── next.config.ts            # Static export + basePath config
├── jest.config.js            # Unit test config (must stay .js — no ts-node)
├── playwright.config.ts      # E2E config (fake-supabase + dev server)
├── eslint.config.mjs         # ESLint 9 flat config
├── postcss.config.js         # Tailwind/PostCSS
├── tsconfig.json             # TS strict, @/ → src/ alias
└── package.json
```

## `src/app/` — Routing Layer

Next.js App Router. Every file is a thin **server component**; interactivity is delegated downward to `'use client'` components.

```
app/
├── layout.tsx                # Root layout (fonts, globals.css, providers)
├── page.tsx                  # Home → <HomeExperience games={games} />
├── globals.css               # Tailwind directives + CSS custom-property theme
└── games/<slug>/page.tsx     # One static route per game (17 games)
```

Each `games/<slug>/page.tsx` reads its metadata from the registry, exports a Next `metadata` object, and renders `<GameLayout title slug><…Game /></GameLayout>`. See `src/app/games/uno/page.tsx` for the canonical shape.

## `src/games/<slug>/` — Game Slices

The heart of the codebase. Each game is a self-contained folder. File presence signals whether a game is single-player or online-multiplayer.

**Single-player game** (e.g. `2048/`, `wordle/`, `tetris/`):

```
<slug>/
├── logic.ts          # Pure state machine — reducers, no React
├── logic.test.ts     # Jest unit tests (≥80% coverage)
└── <Name>Game.tsx    # 'use client' renderer
```

**Online-multiplayer game** (e.g. `uno/`, `skribbl/`, `codenames/`, `cards-against-humanity/`, `agario/`, `mindmeld/`):

```
<slug>/
├── logic.ts            # Pure reducers
├── logic.test.ts       # Reducer unit tests
├── schema.ts           # Zod schema for serialized state + broadcasts
├── schema.test.ts      # Schema tests (present for most, not all)
├── use<Name>Room.ts    # Adapter configuring the shared useGameRoom hook
├── <Name>Game.tsx      # 'use client' renderer
└── <Name>Game.module.css   # Scoped styles (some games)
```

Games present: `2048`, `agario`, `bounce`, `breakout`, `cards-against-humanity`, `codenames`, `hangman`, `memory`, `mindmeld`, `minesweeper`, `skribbl`, `snake`, `sudoku`, `tetris`, `tic-tac-toe`, `uno`, `wordle` (17 total).

## `src/components/` — Shared UI

```
components/
├── GameLayout.tsx              # Game-page wrapper with back button
├── ErrorBoundary.tsx           # Crash containment around game surfaces
├── GameRulesGate.tsx           # Shows rules before play
├── home/
│   ├── HomeExperience.tsx      # Top-level home composition
│   ├── DiscoverView.tsx        # Discover/browse view
│   ├── LibraryView.tsx         # Library listing view
│   └── GamePoster.tsx          # Game tile/poster
└── multiplayer/                # Reusable lobby/room UI (well-tested)
    ├── ArcadeShell.tsx (+ .module.css)
    ├── ArcadeAvatar.tsx
    ├── AvatarPicker.tsx (+ .test)
    ├── LobbyActions.tsx (+ .test)
    ├── PlayerRoster.tsx (+ .test)
    ├── ResultsTable.tsx (+ .test)
    ├── ResumeSessionButton.tsx (+ .test)
    ├── ResumeSessionCard.tsx (+ .test)
    └── RoomInviteCard.tsx (+ .test)
```

The `multiplayer/` subfolder is the shared component library for online games — lobbies, rosters, invites, results. These have co-located `.test.tsx` files (React Testing Library).

## `src/data/` — Static Data

```
data/
├── games.ts                   # GameMeta[] registry — single source of truth
└── words/                     # JSON word lists
    ├── wordle-answers.json, wordle-valid-guesses.json
    ├── hangman-easy/medium/hard.json
    ├── codenames-words.json
    └── skribbl-words.json
```

## `src/hooks/` & `src/lib/` — Cross-Cutting Code

```
hooks/
├── useGameRoom.ts             # Generic multiplayer room engine (central abstraction)
├── useInviteCode.ts (+ .test) # Reads #code=XXXX from URL hash

lib/
├── supabase.ts                # Supabase client OR fake client (E2E)
├── player-name.ts             # Player name helpers
├── utils.ts                   # cn() — clsx + tailwind-merge
└── e2e/fake-supabase.ts       # In-memory Supabase stand-in
```

## `e2e/` — End-to-End Tests

```
e2e/
├── fake-supabase/server.mjs   # Standalone fake Supabase HTTP server
├── pages/                      # Page Object Models per game + lobby
├── games/*.spec.ts             # Per-game E2E specs
├── helpers/                    # navigation, players, fakeSupabase helpers
├── multiplayer-room-contract.spec.ts
├── race-conditions.spec.ts
└── home.spec.ts
```

## Naming Conventions

| Kind           | Convention                  | Example                   |
| -------------- | --------------------------- | ------------------------- |
| Game folder    | kebab-case slug             | `cards-against-humanity/` |
| Route folder   | matches slug                | `app/games/tic-tac-toe/`  |
| Pure logic     | `logic.ts`                  | `games/uno/logic.ts`      |
| Unit test      | co-located `*.test.ts(x)`   | `logic.test.ts`           |
| Game component | PascalCase `<Name>Game.tsx` | `UnoGame.tsx`             |
| Room hook      | `use<Name>Room.ts`          | `useUnoRoom.ts`           |
| Schema         | `schema.ts`                 | `games/skribbl/schema.ts` |
| Scoped CSS     | `*.module.css`              | `UnoGame.module.css`      |
| E2E spec       | `*.spec.ts` under `e2e/`    | `e2e/games/uno.spec.ts`   |
| Page object    | PascalCase `<Name>Page.ts`  | `e2e/pages/UnoPage.ts`    |

## Key Locations (Quick Reference)

- **Add a game to the home grid** → `src/data/games.ts`
- **Game rules / state machine** → `src/games/<slug>/logic.ts`
- **Multiplayer networking** → `src/hooks/useGameRoom.ts` + per-game `use<Name>Room.ts`
- **Network payload validation** → `src/games/<slug>/schema.ts`
- **Theme tokens** → `src/app/globals.css`
- **Static-export / basePath config** → `next.config.ts`
- **DB schema** → `supabase-schema.sql`
