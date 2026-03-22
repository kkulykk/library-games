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

# ── Telegram channel plugin ─────────────────────────────────────────────────
TELEGRAM_PLUGIN_DIR="$HOME/.claude/plugins/telegram@claude-plugins-official"

if [ ! -f "$TELEGRAM_PLUGIN_DIR/server.ts" ]; then
  echo "Installing Telegram channel plugin..."
  mkdir -p "$TELEGRAM_PLUGIN_DIR"
  TEMP_DIR=$(mktemp -d)
  git clone --filter=blob:none --sparse --quiet \
    https://github.com/anthropics/claude-plugins-official.git "$TEMP_DIR" 2>/dev/null
  git -C "$TEMP_DIR" sparse-checkout set external_plugins/telegram
  cp -r "$TEMP_DIR/external_plugins/telegram/." "$TELEGRAM_PLUGIN_DIR/"
  rm -rf "$TEMP_DIR"
  bun install --cwd "$TELEGRAM_PLUGIN_DIR" --no-summary 2>/dev/null
  echo "Telegram plugin installed."
fi

# Configure token from TELEGRAM_BOT_TOKEN secret (set this in your web session secrets)
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  mkdir -p "$HOME/.claude/channels/telegram"
  printf 'TELEGRAM_BOT_TOKEN=%s\n' "$TELEGRAM_BOT_TOKEN" > "$HOME/.claude/channels/telegram/.env"
  echo "Telegram bot token configured."
fi
