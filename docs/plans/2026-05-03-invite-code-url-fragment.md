# Invite Code URL Fragment Implementation Plan

> **For Hermes:** Implement directly with strict TDD. Keep the change scoped to invite-code URL handling and tests.

**Goal:** Fix GitHub issue #130 by moving invite codes from query strings to URL fragments so room codes are not sent in HTTP referers or server logs.

**Architecture:** `getInviteLink()` should generate `/library-games/games/<slug>#code=<roomCode>`. `useInviteCode()` should read `code` from `window.location.hash`, with backward-compatible query-string fallback for old links.

**Tech Stack:** Next.js 15, React hook, Jest + Testing Library.

---

### Task 1: Update tests for fragment-based invite links

**Objective:** Add failing coverage that proves new invite links use `#code=` and that the hook reads fragment codes.

**Files:**

- Modify: `src/hooks/useInviteCode.test.ts`

**Steps:**

1. Change `getInviteLink` expectation from `?code=ABC123` to `#code=ABC123`.
2. Add/adjust `useInviteCode` tests so the primary case uses `/#code=abc123`.
3. Keep query-string fallback coverage for old links.
4. Run `pnpm test -- src/hooks/useInviteCode.test.ts`; expected failure before implementation.

### Task 2: Implement fragment parsing and link generation

**Objective:** Generate fragment invite URLs and parse fragment codes first.

**Files:**

- Modify: `src/hooks/useInviteCode.ts`

**Steps:**

1. Add a small helper to normalize a raw code: trim, uppercase, return null for empty.
2. Read `code` from `window.location.hash` first using `new URLSearchParams(hashWithoutHash)`.
3. If no fragment code exists, fall back to `window.location.search` for backward compatibility.
4. Change `getInviteLink` to return `#code=${encodeURIComponent(roomCode)}`.
5. Run `pnpm test -- src/hooks/useInviteCode.test.ts`; expected pass.

### Task 3: Update E2E contract expectation

**Objective:** Keep Playwright invite-link contract aligned with fragment URLs.

**Files:**

- Modify: `e2e/multiplayer-room-contract.spec.ts`

**Steps:**

1. Change invite link expectation from `?code=` to `#code=`.
2. Run targeted unit test and lint.

### Task 4: Verify and open PR

**Objective:** Commit, push, and open a PR closing #130.

**Steps:**

1. Run `pnpm lint`.
2. Run `pnpm test -- src/hooks/useInviteCode.test.ts`.
3. Commit only touched files.
4. Push branch and create PR with title `fix: move invite codes to URL fragments`.
