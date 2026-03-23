#!/usr/bin/env bash
# Launch Chrome DevTools MCP with InnoMapCAD extension loaded
set -euo pipefail

EXTENSION_DIR="${EXTENSION_DIR:-$(dirname "$0")/../extension/dist}"
EXTENSION_DIR="$(cd "$EXTENSION_DIR" && pwd)"

exec npx @anthropic-ai/chrome-devtools-mcp@latest \
  --chrome-args="--disable-extensions-except=${EXTENSION_DIR},--load-extension=${EXTENSION_DIR}"
