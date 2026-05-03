# Group Dependabot Updates Implementation Plan

> **For Hermes:** Implement directly. This is a repository configuration change, so verification is config review plus lint where applicable.

**Goal:** Configure Dependabot so dependency bumps are batched into grouped PRs instead of one PR per tiny package update.

**Architecture:** Use Dependabot `groups` in `.github/dependabot.yml`. Dependabot groups are scoped per `package-ecosystem`, so npm dependencies and GitHub Actions updates must be separate grouped PRs. Set `open-pull-requests-limit: 1` per ecosystem so Dependabot keeps at most one active grouped PR for npm and one for actions; after a group PR is merged, the next scheduled run can open the next group.

**Tech Stack:** GitHub Dependabot version updates, npm/pnpm, GitHub Actions.

---

### Task 1: Update Dependabot config

**Objective:** Replace default one-PR-per-dependency behavior with grouped updates.

**Files:**

- Modify: `.github/dependabot.yml`

**Steps:**

1. Keep the existing weekly schedule for npm and GitHub Actions.
2. Add `open-pull-requests-limit: 1` to each ecosystem.
3. Add one npm group matching all dependency patterns.
4. Add one GitHub Actions group matching all action patterns.
5. Use clear group identifiers so PR titles are understandable.

### Task 2: Verify configuration

**Objective:** Ensure the YAML is valid and no repo formatting checks are broken.

**Steps:**

1. Run a YAML parser against `.github/dependabot.yml`.
2. Run `pnpm prettier --check .github/dependabot.yml docs/plans/2026-05-03-group-dependabot-updates.md`.
3. Commit and open a PR.

### Expected behavior after merge

- Dependabot npm updates become one grouped PR named around `npm-dependencies`.
- Dependabot GitHub Actions updates become one grouped PR named around `github-actions`.
- Dependabot cannot create one cross-ecosystem PR; GitHub scopes groups by ecosystem. This is the closest native setup without replacing Dependabot with Renovate.
