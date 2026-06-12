# Architecture

**Analysis Date:** 2026-06-12

## Overview

Library Games is a **static, client-rendered game arcade** built on Next.js 15 (App Router) with `output: 'export'`. It ships as a fully static bundle to GitHub Pages — there is no application server, no API routes, and no server actions that write data. All interactivity lives in the browser; online multiplayer is brokered through Supabase (Postgres + Realtime) acting as a shared state bus rather than a custom game server.

The architecture separates cleanly into two halves:

- **Single-player games** — self-contained pure logic + a `'use client'` React renderer. No network.
- **Online-multiplayer games** — the same pure-logic core, plus a per-game room hook that layers on top of a single shared, generic `useGameRoom` hook for room lifecycle and realtime sync.

## Architectural Pattern

**Pattern:** Pure-core / imperative-shell, repeated per game.

Every game is a vertical slice under `src/games/<slug>/`:

- `logic.ts` — a pure state machine. Plain functions of the form `(state, action) => newState`. No React, no I/O, no `Date.now()` in the reducer path where avoidable. Fully unit-tested in `logic.test.ts` (≥80% coverage target).
- `<Name>Game.tsx` — a `'use client'` component. Owns rendering, input wiring, animation loops, and local React state. Delegates all rules to `logic.ts`.
- `schema.ts` (multiplayer only) — Zod schema describing the serialized game state and broadcast messages. Used to validate every payload crossing the network boundary.
- `use<Name>Room.ts` (multiplayer only) — thin adapter that configures the shared `useGameRoom` hook with this game's table name, channel prefix, session key, schema, and reducer.

This keeps the "what are the rules" question (testable, pure) strictly separate from the "how is it shown / synced" question (React + Supabase).

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  Routing layer       src/app/**/page.tsx                 │
│   - Server components, just metadata + <GameLayout>      │
│   - One static route per game (output: 'export')         │
├─────────────────────────────────────────────────────────┤
│  Presentation layer  src/components/**, <Name>Game.tsx   │
│   - 'use client' React, rendering + input + animation    │
│   - Home experience, multiplayer lobby/roster/results UI │
├─────────────────────────────────────────────────────────┤
│  Coordination layer  src/hooks/useGameRoom.ts            │
│   - Generic room lifecycle: create/join/restore/dispatch │
│   - Realtime subscribe, presence, optimistic dispatch    │
│   - Per-game use<Name>Room.ts adapters configure it      │
├─────────────────────────────────────────────────────────┤
│  Domain layer        src/games/<slug>/logic.ts           │
│   - Pure reducers, no React, no I/O                      │
│   - schema.ts (Zod) guards the serialization boundary    │
├─────────────────────────────────────────────────────────┤
│  Infrastructure      src/lib/supabase.ts, lib/utils.ts   │
│   - Supabase client (or fake client for E2E)            │
│   - cn() helper, player-name, invite-code helpers        │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Single-player

```
user input → <Name>Game.tsx event handler
           → applyAction(state, action) in logic.ts  [pure]
           → setState(newState) → re-render
```

State lives in React component state only. Nothing leaves the browser.

### Online multiplayer (Supabase as state bus)

The canonical reference is `src/games/uno/`. The full game state is stored in a single `jsonb` `state` column of a per-game table, alongside an integer `version` column used for optimistic concurrency.

**Dispatch (write path)** — `src/hooks/useGameRoom.ts:379` `dispatch`:

```
local action
  → applyAction(currentState, action)          [pure reducer]
  → supabase.update({ state, version+1 })
        .eq('code', room).eq('version', current) [compare-and-swap]
  → on success: setState optimistically (instant feel)
  → on version conflict: re-read fresh state, retry (up to 3x)
```

**Sync (read path)** — `subscribeToRoom` at `src/hooks/useGameRoom.ts:164`:

```
Postgres UPDATE on the room row
  → realtime postgres_changes event
  → stateSchema.safeParse(payload.new.state)   [Zod guard]
  → setStateAndRef(parsed, payload.new.version)
```

**Presence** — a separate Supabase presence channel (`useGameRoom.ts:132`) tracks which `player_id`s are currently connected, surfaced as `onlinePlayerIds`.

**Ephemeral broadcast** — optional. Some games (e.g. Skribbl drawing strokes) need high-frequency, non-persisted messages. `BroadcastConfig` adds a Supabase broadcast channel so transient events bypass the DB entirely (`useGameRoom.ts:191`).

### Concurrency model

Optimistic concurrency via a monotonically increasing `version` integer. Every write is a compare-and-swap on `version`; a losing writer re-reads and retries (max 3). This is the project's substitute for transactions/locks, since there is no server to serialize actions.

## Key Abstractions

- **`useGameRoom<TState, TAction, TBroadcast>`** (`src/hooks/useGameRoom.ts`) — the single most important abstraction. A generic, schema-driven room engine. Each multiplayer game supplies a `GameRoomConfig`: `tableName`, `channelPrefix`, `sessionKey`, `stateSchema` (Zod), `applyAction` (reducer), and lobby/player factory functions. Returns `{ gameState, playerId, roomCode, status, createRoom, joinRoom, restoreSession, dispatch, leaveRoom, broadcast, onBroadcast, onlinePlayerIds }`.
- **`GameRoomConfig` / `BaseGameState`** — the contract every multiplayer game's state must satisfy: a `phase: string` and `players: { id }[]`. Enforced at the type level.
- **`GameMeta`** (`src/data/games.ts`) — single source of truth for game registry metadata (slug, title, status, category, emoji, tags). Drives the home grid and per-game routes.
- **Zod schemas** (`src/games/*/schema.ts`) — the trust boundary. Every state/broadcast payload from the network is `safeParse`d before entering React state; invalid payloads are logged and dropped.
- **Fake Supabase client** (`src/lib/e2e/fake-supabase.ts`) — in-memory drop-in selected via `NEXT_PUBLIC_E2E_FAKE_SUPABASE=1`, letting multiplayer flows run in Playwright E2E without a real backend.
- **Session persistence** — `useGameRoom` writes a 24h-TTL session (`roomCode`, `playerId`, `playerName`) to `localStorage`, enabling reconnect/resume after refresh.

## Entry Points

- **`src/app/layout.tsx`** — root layout; global providers, fonts, `globals.css`.
- **`src/app/page.tsx`** — home page; renders `<HomeExperience games={games} />` from the registry.
- **`src/app/games/<slug>/page.tsx`** — one server component per game. Pulls metadata from the registry, wraps the client game in `<GameLayout>`. Exports `metadata` for SEO.
- **`src/games/<slug>/<Name>Game.tsx`** — the actual interactive client entry per game.
- **`next.config.ts`** — `output: 'export'`, `basePath: '/library-games'`, `images.unoptimized: true`.

## Cross-Cutting Concerns

- **Theming** — Tailwind 3 + CSS custom properties (shadcn-style) defined in `src/app/globals.css`. `cn()` in `src/lib/utils.ts` merges class names.
- **Error containment** — `src/components/ErrorBoundary.tsx` wraps game surfaces so a crashing game doesn't take down the shell.
- **Rules gating** — `src/components/GameRulesGate.tsx` shows rules before play.
- **Validation** — Zod at every network boundary (see Key Abstractions).
- **Static-export constraint** — no SSR data fetching, no API routes, no server actions that write. Everything must render to static HTML at build time; dynamic behavior is client-only.

## Design Decisions & Rationale

- **Supabase as a state bus, not a game server** — avoids running/operating a stateful WebSocket backend. The cost is that authority is client-side; correctness relies on the pure reducer being deterministic plus version-based CAS to resolve races.
- **One generic room hook, many thin adapters** — every multiplayer game reuses the same lifecycle/sync/presence/retry logic. Adding a game means writing a reducer, a schema, and a small config — not re-implementing networking.
- **Pure logic isolation** — enables fast, deterministic unit tests and makes the same reducer safely runnable on both the optimistic local path and the authoritative re-read path.
- **Full game state in one `jsonb` column** — simplest possible persistence; the whole state is overwritten on each action. Trades storage/bandwidth efficiency for radical simplicity and schema-less evolution (guarded by Zod).
