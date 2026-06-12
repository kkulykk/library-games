# External Integrations

**Analysis Date:** 2026-06-12

## APIs & External Services

**Real-time Multiplayer State Bus:**

- Supabase - WebSocket subscriptions for online multiplayer games
  - SDK/Client: `@supabase/supabase-js` 2.106.2
  - Auth: Public anon key (design: room codes act as access tokens)
  - Pattern: `postgres_changes` subscriptions on game room tables for state updates

## Data Storage

**Primary Database:**

- Supabase PostgreSQL
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (build-time public env var)
  - Client: `@supabase/supabase-js` browser client
  - Client auth: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (build-time public env var)

**Database Schema:**

- File: `supabase-schema.sql`
- Tables: `uno_rooms`, `skribbl_rooms`, `agario_rooms`, `cah_rooms`, `codenames_rooms`, `mindmeld_rooms`
- Structure per table:
  - `id` (UUID primary key)
  - `code` (TEXT unique, 4-char uppercase alphanumeric - room access token)
  - `state` (JSONB - complete game state snapshot)
  - `version` (INTEGER - optimistic lock counter)
  - `updated_at` (TIMESTAMPTZ - auto-updated on row modification)

**Realtime Triggers:**

- `update_updated_at()` - Auto-timestamps on UPDATE
- `protect_immutable_columns()` - Prevents mutation of id/code columns
- Row Level Security enabled - No explicit DELETE policy (cleanup via pg_cron only)

**Auto-cleanup:**

- pg_cron job scheduled at `0 * * * *` (hourly) - Deletes rooms older than 24 hours
- Manual cleanup commented in schema for on-demand execution

**File Storage:**

- None - client-side games only, no asset uploads

**Caching:**

- None - all state flows through Supabase in real-time

## Authentication & Identity

**Auth Provider:**

- None - Supabase anon key only (no user authentication)
- Access control: Room codes are public access tokens
- Security: Row Level Security policies on tables prevent enumeration without code knowledge

**Auth Policies:**

- SELECT: Allow all (codes are the protection)
- INSERT: Enforce `code ~ '^[A-Z0-9]{4}$'` format + non-null state
- UPDATE: Allow all (immutable column protection via trigger)
- DELETE: No policy (denied by default with RLS enabled, cleanup only via pg_cron)

## Monitoring & Observability

**Error Tracking:**

- None - errors handled client-side, logged to console

**Logs:**

- Standard console output
- Playwright: HTML reports in `playwright-report/` with videos/screenshots on failure
- GitHub Actions: Build logs in CI workflow runs

## CI/CD & Deployment

**Hosting:**

- GitHub Pages
  - URL: `https://kkulykk.github.io/library-games`
  - Base path: `/library-games` (configured in `next.config.ts`)
  - Source: GitHub Actions (automatic deployment on main push)

**CI Pipeline:**

- GitHub Actions (`.github/workflows/ci.yml`)
- Trigger: All pushes and PRs
- Stages:
  1. **lint-and-test** (ubuntu-latest)
     - ESLint + Prettier checks
     - Jest unit tests with 80% coverage
  2. **e2e** (ubuntu-latest)
     - Starts fake Supabase server on port 54321
     - Runs Playwright tests with fake data
     - Uploads artifacts on failure (playwright-report, test-results)
  3. **build** (ubuntu-latest)
     - Injects Supabase secrets at build time: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - Exports to `/out`
     - Uploads Pages artifact
  4. **deploy** (github-pages environment)
     - Runs only on `main` branch push
     - Uses `actions/deploy-pages@v5`

**Deployment Flow:**

```
Commit to main
    ↓
Lint + Test (ESLint, Prettier, Jest)
    ↓
E2E (Playwright with fake Supabase)
    ↓
Build (Next.js static export + Supabase secrets)
    ↓
Deploy (GitHub Pages)
```

## Environment Configuration

**Build-time Public Variables:**

- `NEXT_PUBLIC_SUPABASE_URL` - Required for production builds (injected via GitHub Actions secrets)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Required for production builds (injected via GitHub Actions secrets)

**Development-time Variables:**

- `.env.local.example` → `.env.local` (user must copy and fill)
- Example file shows: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` required

**E2E Testing Variables:**

- `NEXT_PUBLIC_E2E_FAKE_SUPABASE='1'` - Enables fake Supabase server (set in `playwright.config.ts`)
- `NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'` - Fake server URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY='e2e-anon-key'` - Fake anon key

**Secrets Storage:**

- GitHub Actions secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Local dev: `.env.local` (git-ignored, user-provided)
- CI/CD: Injected at build time in `.github/workflows/ci.yml`

## Webhooks & Callbacks

**Incoming:**

- None - no inbound webhooks

**Outgoing:**

- Supabase Realtime subscriptions act as "pull" webhooks:
  - Game state updates trigger `UPDATE` events on room tables
  - Browser clients subscribe via `supabase.channel()` and listen for `postgres_changes`
  - No outbound HTTP webhooks

**Pattern:**

- Hook registration: `src/hooks/useGameRoom.ts` (generic multiplayer hook)
- Game-specific hooks: `src/games/<slug>/use<Name>Room.ts`
- Subscription: `channel.on('postgres_changes', { event: 'UPDATE', ... }, callback)`
- Dispatch: Update game state in Supabase via `supabase.from(tableName).update(newState).eq(...)`

## Fake Supabase Server (E2E)

**Purpose:**

- Isolated testing without cloud dependency
- Deterministic state resets between tests
- No need for test credentials in CI

**Implementation:**

- Server: `e2e/fake-supabase/server.mjs`
- Runs on `http://127.0.0.1:54321` during `playwright test`
- Shares single in-memory state across tests
- Resets before each test (reason for serial execution, not parallel)

**Configuration in Playwright:**

- Web server 1: Fake Supabase server
- Web server 2: Next.js dev server with fake env vars
- Base URL: `http://127.0.0.1:3000/library-games`

---

_Integration audit: 2026-06-12_
