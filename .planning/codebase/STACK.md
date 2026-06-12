# Technology Stack

**Analysis Date:** 2026-06-12

## Languages

**Primary:**

- TypeScript 6.0.3 - Complete codebase, strict mode enabled
- React 19.2.6 - UI framework with App Router

**Secondary:**

- JavaScript (Node.js config files)
- CSS (Tailwind + CSS custom properties)
- SQL (Supabase schema via `supabase-schema.sql`)

## Runtime

**Environment:**

- Node.js 20 (as per CI/CD configuration in `.github/workflows/ci.yml`)

**Package Manager:**

- pnpm 9 - Dependency manager (configured in CI with `pnpm/action-setup@v6`)
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

**Core:**

- Next.js 16.2.6 - React framework with App Router (`output: 'export'` for static generation)
- React 19.2.6 - UI library

**Styling:**

- Tailwind CSS 4.3.0 - Utility-first CSS with custom properties
- PostCSS 8.5.15 - CSS processing via `@tailwindcss/postcss` plugin
- CSS Custom Properties - Theme variables in `src/app/globals.css` (oklch color space)

**Build/Dev:**

- Next.js 16.2.6 - Build and dev server
- ESLint 9.0.0 - Flat config (`eslint.config.mjs`)
- TypeScript 6.0.3 - Type checking

**Testing:**

- Jest 30.4.2 - Unit test runner (`jest.config.js`)
  - `jest-environment-jsdom` for DOM testing
  - Configuration in `jest.config.js` with 80% coverage threshold
  - Setup file: `jest.setup.ts`

**E2E Testing:**

- Playwright 1.60.0 - End-to-end testing
  - Configuration in `playwright.config.ts`
  - Runs tests serially (1 worker) due to shared fake Supabase state
  - Reporters: GitHub format in CI, HTML locally

## Key Dependencies

**Critical:**

- @supabase/supabase-js 2.106.2 - Real-time state management for multiplayer games via Postgres subscriptions
- zod 4.4.3 - Runtime schema validation for game state (used in `src/games/*/schema.ts`)
- clsx 2.1.1 - Utility for merging classNames
- tailwind-merge 3.6.0 - Merge Tailwind utility classes (via `cn()` helper in `src/lib/utils.ts`)
- class-variance-authority 0.7.1 - Component variant system

**UI Components:**

- lucide-react 1.17.0 - Icon library

**Development Tools:**

- typescript-eslint 8.60.0 - ESLint rules for TypeScript
- eslint-config-next 16.2.6 - Next.js ESLint config
- eslint-config-prettier 10.0.0 - Disable ESLint rules conflicting with Prettier
- prettier 3.8.3 - Code formatter with `prettier-plugin-tailwindcss` for class sorting
- husky 9.1.7 - Git hooks
- lint-staged 17.0.6 - Run linters on staged files

**Testing Libraries:**

- @testing-library/react 16.0.1 - React component testing utilities
- @testing-library/jest-dom 6.6.3 - Custom Jest matchers
- @testing-library/user-event 14.5.2 - User interaction simulation

**Type Definitions:**

- @types/node 25.9.1 - Node.js type definitions
- @types/react 19.2.15 - React type definitions
- @types/react-dom 19.1.0 - React DOM type definitions
- @types/jest 30.0.0 - Jest type definitions

## Configuration

**TypeScript:**

- Config file: `tsconfig.json`
- Strict mode: enabled
- Target: ES2017
- Module resolution: bundler
- Path alias: `@/` → `src/`
- JSX: react-jsx

**ESLint:**

- Config file: `eslint.config.mjs` (ESLint 9 flat config)
- Extends: `eslint-config-next/core-web-vitals`, `eslint-config-prettier`
- Plugins: `typescript-eslint`
- Ignores: `.next/`, `out/`, `node_modules/`, `coverage/`, `playwright-report/`, `test-results/`

**Prettier:**

- Config file: `.prettierrc`
- Single quotes: enabled
- Semicolons: disabled
- Print width: 100 characters
- Trailing comma: es5
- Plugins: `prettier-plugin-tailwindcss` (sorts Tailwind classes)

**Jest:**

- Config file: `jest.config.js`
- Test environment: jsdom
- Module path mapper: `@/*` → `src/*`
- Coverage collection: `src/games/**/logic.ts` only
- Coverage threshold: 80% (lines, functions, branches, statements)
- Setup file: `jest.setup.ts`

**PostCSS:**

- Config file: `postcss.config.js`
- Single plugin: `@tailwindcss/postcss`

**Next.js:**

- Config file: `next.config.ts`
- Output: static export (`output: 'export'`)
- Base path: `/library-games` (GitHub Pages deployment)
- Images: unoptimized (no server-side optimization)

**Playwright:**

- Config file: `playwright.config.ts`
- Test directory: `e2e/`
- Browsers: Chromium only
- Workers: 1 (serial execution for state isolation)
- Reporters: GitHub format in CI, HTML locally

## Build System

**Development:**

```bash
pnpm dev              # Next.js dev server on http://localhost:3000/library-games
```

**Production:**

```bash
pnpm build            # Static export to /out
```

**Output:**

- Directory: `/out` (static HTML/CSS/JS artifacts)
- Deployment: GitHub Pages via GitHub Actions

## Platform Requirements

**Development:**

- Node.js 20+
- pnpm 9+
- Git (for Husky hooks)

**Production:**

- Static hosting (GitHub Pages, Vercel, Netlify, etc.)
- No server-side execution required
- No database connectivity needed (client-side only, Supabase via browser client)

**Environment Variables (build-time):**

- `NEXT_PUBLIC_SUPABASE_URL` - Injected during CI build for static export
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Injected during CI build for static export

## CI/CD Stack

**Workflow:** `.github/workflows/ci.yml`

- Runner: ubuntu-latest
- Node.js 20 setup
- pnpm caching enabled
- Three-stage pipeline:
  1. **lint-and-test** - ESLint, Prettier, Jest with coverage ≥80%
  2. **e2e** - Playwright tests with fake Supabase server
  3. **build** - Next.js static export with Supabase secrets
  4. **deploy** - GitHub Pages deployment (main push only)

---

_Stack analysis: 2026-06-12_
