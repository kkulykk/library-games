# Maintenance Baseline Gates Implementation Plan

> **For Hermes:** Implement this plan directly, updating task status as each step completes.

**Goal:** Complete roadmap items `P0-01`, `P0-02`, and `P0-05` by adding an explicit TypeScript gate, wiring it into CI, and documenting the minimum pre-merge checks.

**Architecture:** Keep this as a tooling/docs-only PR. Add one package script, one CI step in the existing `lint-and-test` job, README guidance, and tracker progress notes. No app runtime behavior should change.

**Tech Stack:** Next.js 16, TypeScript, pnpm, GitHub Actions, Markdown docs.

---

## Tasks

### Task 1: Add the local TypeScript gate

**Status:** Completed

**Objective:** Add a dedicated `pnpm typecheck` command that runs the existing TypeScript project configuration without emitting files.

**Files:**

- Modify: `package.json`

**Steps:**

1. Add `"typecheck": "tsc --noEmit"` under `scripts` after `lint:fix`.
2. Run `pnpm typecheck`.
3. Fix any typecheck-only failures if they are related to this script addition.

**Verification:** `pnpm typecheck` exits 0.

### Task 2: Wire typecheck into CI

**Status:** Completed

**Objective:** Make CI run the same TypeScript gate after formatting and before coverage tests.

**Files:**

- Modify: `.github/workflows/ci.yml`

**Steps:**

1. Add a `Run TypeScript check` step after `Run Prettier check`.
2. Use `run: pnpm typecheck` so CI uses the package script.
3. Keep the existing lint, coverage, E2E, build, and deploy job structure unchanged.

**Verification:** Inspect workflow diff and run local `pnpm typecheck`; full CI will verify on PR.

### Task 3: Document the minimum pre-merge gate

**Status:** Completed

**Objective:** Make local contributor expectations match CI by listing lint, typecheck, coverage, E2E, and build commands.

**Files:**

- Modify: `README.md`

**Steps:**

1. Add `pnpm typecheck` to the development command list.
2. Add a short `Pre-merge verification` section naming the minimum gate:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test:coverage`
   - `pnpm e2e:ci`
   - `pnpm build`
3. Mention that PR CI runs lint/format, typecheck, coverage, E2E, and build before deploy.

**Verification:** `pnpm exec prettier --check README.md` exits 0.

### Task 4: Update the roadmap tracker

**Status:** Completed

**Objective:** Mark `P0-01`, `P0-02`, and `P0-05` complete with dated notes and verification commands.

**Files:**

- Modify: `docs/plans/2026-06-18-maintenance-cleanup-action-tracker.md`

**Steps:**

1. Change statuses for `P0-01`, `P0-02`, and `P0-05` from `Todo` to `Done`.
2. Update the progress summary counts for Phase 0 and overall totals.
3. Add a progress note with the implemented commands and verification results.

**Verification:** `pnpm exec prettier --check docs/plans/2026-06-18-maintenance-cleanup-action-tracker.md` exits 0.

### Task 5: Run quality gates and prepare PR

**Status:** Completed

**Objective:** Verify the tooling/docs change and open a PR.

**Files:**

- All touched files

**Steps:**

1. Run `pnpm lint`.
2. Run `pnpm typecheck`.
3. Run `pnpm test:coverage`.
4. Run `pnpm build`.
5. Commit changes with a conventional commit.
6. Push branch and create PR referencing `P0-01`, `P0-02`, and `P0-05`.

**Verification:** Commands above exit 0, branch is pushed, PR URL is available.
