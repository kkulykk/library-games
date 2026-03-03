#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install gh CLI if not present
if ! command -v gh &>/dev/null; then
  apt-get install -y gh
fi

# Install pnpm dependencies
pnpm install

# Persist GH_REPO so gh CLI works without a github.com remote URL
echo 'export GH_REPO=kkulykk/library-games' >> "$CLAUDE_ENV_FILE"

# Persist GH_TOKEN if gh is already authenticated (credentials cached from prior session)
if gh auth token &>/dev/null; then
  echo "export GH_TOKEN=$(gh auth token)" >> "$CLAUDE_ENV_FILE"
fi
