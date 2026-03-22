#!/usr/bin/env bash
# Wrapper: starts chrome-devtools-mcp with extension auto-loaded
# This script is referenced by .mcp.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Default to test-extension, override with EXTENSION_DIR env var
EXTENSION_PATH="${EXTENSION_DIR:-$PROJECT_DIR/test-extension}"

if [ ! -f "$EXTENSION_PATH/manifest.json" ]; then
  echo "ERROR: No manifest.json in $EXTENSION_PATH" >&2
  exit 1
fi

EXTENSION_PATH="$(cd "$EXTENSION_PATH" && pwd)"

# Find chrome binary
CHROME_BIN="${CHROME_BIN:-}"
if [ -z "$CHROME_BIN" ]; then
  CHROME_BIN="/home/lord/.cache/puppeteer-browsers/chrome/linux-146.0.7680.153/chrome-linux64/chrome"
fi
if [ ! -f "$CHROME_BIN" ]; then
  CHROME_BIN=$(find ~/.cache/puppeteer-browsers -name "chrome" -type f 2>/dev/null | head -1 || true)
fi
if [ ! -f "$CHROME_BIN" ]; then
  echo "ERROR: Chrome binary not found" >&2
  exit 1
fi

exec npx -y chrome-devtools-mcp@latest \
  --headless \
  --executablePath "$CHROME_BIN" \
  --ignoreDefaultChromeArg=--disable-extensions \
  --chromeArg="--disable-extensions-except=$EXTENSION_PATH" \
  --chromeArg="--load-extension=$EXTENSION_PATH" \
  --chromeArg=--no-sandbox \
  --chromeArg=--disable-dev-shm-usage
