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
pnpm e2e              # playwright test (E2E, uses in-memory fake Supabase)
pnpm e2e:ui           # playwright test --ui
pnpm e2e:debug        # playwright test --debug

# Run a single test file:
pnpm test -- src/games/wordle/logic.test.ts

# Occasional, network-dependent data jobs (never wired into CI):
pnpm generate:worldmap   # rebuild Globetrotter land/country polygons
pnpm generate:reserve    # widen Globetrotter's offline Random World deck
```

## Architecture

**Framework:** Next.js 16, App Router, static export (`output: 'export'`), React 19, TypeScript strict mode.

**Hosting:** GitHub Pages at `https://kkulykk.github.io/library-games`. `basePath: '/library-games'` is set in `next.config.ts` — do not remove it.

**Styling:** Tailwind CSS 4 (`@tailwindcss/postcss`) with CSS custom properties for theming (shadcn-style). Variables defined in `src/app/globals.css`.

**Path alias:** `@/` maps to `src/`.

**Key paths:**

- `src/app/page.tsx` — home page (renders `<HomeExperience games={games} />`)
- `src/app/games/<slug>/page.tsx` — per-game route (server component, just wraps game component)
- `src/components/home/` — home UI (`HomeExperience`, `DiscoverView`, `LibraryView`, `GamePoster`)
- `src/components/GameLayout.tsx` — shared wrapper with back button for game pages
- `src/components/multiplayer/` — reusable lobby/roster/results/invite UI for online games
- `src/data/games.ts` — single source of truth for all game metadata (`GameMeta` type)
- `src/games/<slug>/logic.ts` — pure game logic (no React, fully unit tested)
- `src/games/<slug>/<Name>Game.tsx` — `'use client'` React component
- `src/games/<slug>/schema.ts` — Zod schema for serialized state (online games)
- `src/games/<slug>/use<Name>Room.ts` — per-game room adapter (online games)
- `src/hooks/useGameRoom.ts` — generic multiplayer room engine (lifecycle, realtime, presence, version CAS)
- `src/lib/supabase.ts` — Supabase client, or in-memory fake client when `NEXT_PUBLIC_E2E_FAKE_SUPABASE=1`
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

## Adding a new game

All games:

1. Add entry to `src/data/games.ts` — all `GameMeta` fields: `slug`, `title`, `description`, `tags`, `status` (`'live'` | `'coming-soon'`), `category` (`'single-player'` | `'online-multiplayer'`), `emoji`
2. Create `src/games/<slug>/logic.ts` — pure functions only, no React
3. Create `src/games/<slug>/logic.test.ts` — unit tests, target ≥80% coverage
4. Create `src/games/<slug>/<Name>Game.tsx` — `'use client'` component
5. Create `src/app/games/<slug>/page.tsx` — wraps game in `<GameLayout>`

Online-multiplayer games additionally need (steps 2–4 above still apply):

6. Create `src/games/<slug>/schema.ts` — Zod schema for the serialized game state (and any broadcast messages); add `schema.test.ts`
7. Create `src/games/<slug>/use<Name>Room.ts` — a thin adapter that configures the shared `useGameRoom` hook (see below)
8. Add the room table + RLS policies to `supabase/schema.sql`
9. Add a Playwright spec under `e2e/games/<slug>.spec.ts` with a page object in `e2e/pages/`

## Online multiplayer games (Supabase)

Online games use Supabase as a real-time state bus — no custom WebSocket server. There is **no game server**: the pure reducer runs in every player's browser and writes the next state to Supabase.

**Pattern (see `src/games/uno/` as reference):**

- `logic.ts` — pure state machine: all actions are plain functions `(state, action) => newState`
- `schema.ts` — Zod schema; every state/broadcast payload crossing the network is `safeParse`d before entering React state
- `use<Name>Room.ts` — a small adapter that passes a `GameRoomConfig` (table name, channel prefix, session key, schema, `applyAction` reducer, player/lobby factories) to the **shared `useGameRoom` hook** (`src/hooks/useGameRoom.ts`). Do not re-implement room lifecycle per game — `useGameRoom` owns create/join/restore, realtime subscription, presence, optimistic dispatch, and 24h `localStorage` session resume.
- Game state lives entirely in a single `jsonb` `state` column, paired with an integer `version` column. Every action overwrites `state` via a compare-and-swap on `version` (optimistic concurrency, retries up to 3× on conflict).
- Realtime `postgres_changes` UPDATE events re-validate via the Zod schema and call `setGameState`.

**Local env:** copy `.env.local.example` → `.env.local` and fill in Supabase URL + anon key. When unset, `supabase` resolves to `null` and online games no-op.

**CI:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set as GitHub Actions secrets for the build to connect. E2E runs against an in-memory fake Supabase (`NEXT_PUBLIC_E2E_FAKE_SUPABASE=1`), not the real backend.

**Database:** schema lives in `supabase/schema.sql`. Apply via Supabase MCP (`mcp__supabase__apply_migration`) or paste into the Supabase SQL Editor. Rooms are deleted only by a `pg_cron` cleanup job (older than 24h) — it must be scheduled manually in the Supabase project; there is no client DELETE policy. One-off ops scripts (already applied to the live project — RLS sealing, rollbacks) live under `supabase/migrations/` for reference; they are not run automatically and don't need to be re-applied to a fresh project since `supabase/schema.sql` embeds their end state.

## Constraints

- **No server-side features** — no `getServerSideProps`, no API routes, no server actions that write data. Everything must be statically renderable.
- **No `next/image`** with optimization — `images: { unoptimized: true }` is set; use plain `<img>` or `next/image` without a loader.
- **Game logic must be pure** — keep all game state logic in `logic.ts` as plain functions. React components only handle rendering and event wiring.

## CI/CD

Two workflows, each with a single responsibility and a single trigger:

- **`test.yml`** (_Test_) — the CI gate. Runs on **every branch push except
  `main`** (`branches-ignore: [main]`). A single `test` job runs
  `pnpm test:all`, which chains `lint` (ESLint + Prettier), `typecheck`,
  `check:schema`, `test:coverage`, and Playwright (`e2e:ci`) against the fake
  Supabase server. Keep the whole gate in `test:all` so it stays one command
  locally and in CI.
- **`deploy.yml`** (_Deploy_) — builds the static export and
  publishes it. Runs **only** on push/merge to `main`. It does not run the test
  suite; gate deploys by requiring **Test** as a branch-protection check on
  `main` so only tested code reaches `deploy`. The Pages artifact is `out/` —
  Next's static export dir, set by `output: 'export'`.

So: a branch push runs tests, a merge to `main` runs the deploy. Neither runs
both. Do not let `test.yml` trigger on `main` — a branch is already green before
it merges, so re-running the suite on the merge commit only creates a way for
`main` to go red after the fact.

Both workflows use **pnpm**, not npm. There is no `package-lock.json`, so
`npm ci` fails outright; `playwright.config.ts` also shells out to `pnpm dev` for
its web server.

**Keep CI deterministic.** A check belongs in the pipeline only if its verdict
depends solely on the commit. `pnpm audit` is the counter-example and is
deliberately not wired into any workflow: it resolves the lockfile against a live
advisory database, so it fails commits that have not changed whenever a new
advisory lands on a transitive dependency. Do not add it back. Apply the same
rule to anything else whose result depends on the outside world at the moment it
runs.

Dependency vulnerabilities are handled out of band instead — Dependabot PRs, or
manually running `pnpm audit --prod` when you want to look. Fix findings by
bumping the dependency, or — when it is a transitive dependency you do not depend
on directly — by adding or raising an entry in `pnpm.overrides` in `package.json`
(that block already pins `postcss`, `@babel/core`, `ws`, and `sharp` past known
advisories).

Never skip the lint, test, or e2e step. Do not force-push to `main`.

## ESLint / Prettier

- ESLint 9 flat config in `eslint.config.mjs`
- Prettier config in `.prettierrc` (single quotes, no semis, 100-char width, tailwind plugin)
- Run `pnpm lint:fix` to auto-fix before committing
