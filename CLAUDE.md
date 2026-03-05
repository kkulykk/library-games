# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Library Games — Claude Guide

## Commands

```bash
pnpm dev              # start dev server → http://localhost:3000/library-games
pnpm build            # static export → /out
pnpm lint             # eslint . && prettier --check .
pnpm lint:fix         # eslint . --fix && prettier --write .
pnpm test             # jest (all tests)
pnpm test:watch       # jest in watch mode
pnpm test:coverage    # jest --coverage (must hit ≥80% on logic files)

# Run a single test file:
pnpm test -- src/games/wordle/logic.test.ts
```

## Architecture

**Framework:** Next.js 15, App Router, static export (`output: 'export'`), React 19, TypeScript strict mode.

**Hosting:** GitHub Pages at `https://kkulykk.github.io/library-games`. `basePath: '/library-games'` is set in `next.config.ts` — do not remove it.

**Styling:** Tailwind CSS 3 with CSS custom properties for theming (shadcn-style). Variables defined in `src/app/globals.css`.

**Path alias:** `@/` maps to `src/`.

**Key paths:**

- `src/app/page.tsx` — home page game grid
- `src/app/games/<slug>/page.tsx` — per-game route (server component, just wraps game component)
- `src/components/GameCard.tsx` — card shown on home page
- `src/components/GameLayout.tsx` — shared wrapper with back button for game pages
- `src/data/games.ts` — single source of truth for all game metadata (`GameMeta` type)
- `src/games/<slug>/logic.ts` — pure game logic (no React, fully unit tested)
- `src/games/<slug>/<Name>Game.tsx` — `'use client'` React component
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

## Adding a new game

1. Add entry to `src/data/games.ts` — all `GameMeta` fields: `slug`, `title`, `description`, `tags`, `status` (`'live'` | `'coming-soon'`), `category` (`'single-player'` | `'online-multiplayer'`), `emoji`
2. Create `src/games/<slug>/logic.ts` — pure functions only, no React
3. Create `src/games/<slug>/logic.test.ts` — unit tests, target ≥80% coverage
4. Create `src/games/<slug>/<Name>Game.tsx` — `'use client'` component
5. Create `src/app/games/<slug>/page.tsx` — wraps game in `<GameLayout>`

## Online multiplayer games (Supabase)

Online games use Supabase as a real-time state bus — no custom WebSocket server.

**Pattern (see `src/games/uno/` as reference):**
- `logic.ts` — pure state machine: all actions are plain functions `(state, action) => newState`
- `use<Name>Room.ts` — React hook that owns room lifecycle: create/join/restore session, subscribe to `postgres_changes`, and `dispatch` actions by writing new state to Supabase
- Game state lives entirely in a single `jsonb` column; every action overwrites it with `update()`
- Realtime subscription fires on `UPDATE` and calls `setGameState(payload.new.state)`

**Local env:** copy `.env.local.example` → `.env.local` and fill in Supabase URL + anon key.

**CI:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set as GitHub Actions secrets for the build to connect.

**Database:** schema lives in `supabase-schema.sql`. Apply via Supabase MCP (`mcp__supabase__apply_migration`) or paste into the Supabase SQL Editor. Rooms auto-delete after 24 hours via a `pg_cron` job scheduled at `0 * * * *`.

## Constraints

- **No server-side features** — no `getServerSideProps`, no API routes, no server actions that write data. Everything must be statically renderable.
- **No `next/image`** with optimization — `images: { unoptimized: true }` is set; use plain `<img>` or `next/image` without a loader.
- **Game logic must be pure** — keep all game state logic in `logic.ts` as plain functions. React components only handle rendering and event wiring.

## CI/CD

Single workflow (`.github/workflows/ci.yml`):

1. **lint-and-test** — runs on every push and PR
2. **build** — only on `main` push, only if lint-and-test passes; injects Supabase secrets
3. **deploy** — GitHub Pages, only after build succeeds

Never skip the lint or test step. Do not force-push to `main`.

## ESLint / Prettier

- ESLint 9 flat config in `eslint.config.mjs`
- Prettier config in `.prettierrc` (single quotes, no semis, 100-char width, tailwind plugin)
- Run `pnpm lint:fix` to auto-fix before committing
