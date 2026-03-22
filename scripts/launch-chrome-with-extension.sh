#!/usr/bin/env bash
# Launch Chrome with extension for MCP testing
# Usage: ./scripts/launch-chrome-with-extension.sh [extension_path] [port]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

EXTENSION_PATH="${1:-$PROJECT_DIR/test-extension}"
DEBUG_PORT="${2:-9222}"

# Find Puppeteer Chrome binary
CHROME_BIN="/home/lord/.cache/puppeteer-browsers/chrome/linux-146.0.7680.153/chrome-linux64/chrome"

if [ ! -f "$CHROME_BIN" ]; then
  # Fallback: find any puppeteer chrome
  CHROME_BIN=$(find ~/.cache/puppeteer-browsers -name "chrome" -type f 2>/dev/null | head -1)
fi

if [ ! -f "$CHROME_BIN" ]; then
  echo "ERROR: Chrome binary not found. Install via: npx puppeteer browsers install chrome"
  exit 1
fi

if [ ! -f "$EXTENSION_PATH/manifest.json" ]; then
  echo "ERROR: No manifest.json found in $EXTENSION_PATH"
  exit 1
fi

EXTENSION_PATH="$(cd "$EXTENSION_PATH" && pwd)"

echo "Chrome: $CHROME_BIN"
echo "Extension: $EXTENSION_PATH"
echo "Debug port: $DEBUG_PORT"
echo ""

USER_DATA_DIR="/tmp/innomapcad-chrome-debug-$$"
mkdir -p "$USER_DATA_DIR"

cleanup() {
  rm -rf "$USER_DATA_DIR"
}
trap cleanup EXIT

exec "$CHROME_BIN" \
  --remote-debugging-port="$DEBUG_PORT" \
  --user-data-dir="$USER_DATA_DIR" \
  --disable-extensions-except="$EXTENSION_PATH" \
  --load-extension="$EXTENSION_PATH" \
  --no-first-run \
  --no-default-browser-check \
  --no-sandbox \
  --disable-dev-shm-usage \
  --headless=new \
  about:blank
