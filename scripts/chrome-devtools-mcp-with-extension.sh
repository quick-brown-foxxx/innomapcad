#!/usr/bin/env bash
# Launch Chrome DevTools MCP with InnoMapCAD extension loaded
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

EXTENSION_DIR="${PROJECT_DIR}/extension/dist"
CHROME_EXECUTABLE="${CHROME_EXECUTABLE:-/home/lord/.cache/puppeteer-browsers/chrome/linux-146.0.7680.153/chrome-linux64/chrome}"
USER_DATA_DIR="/home/lord/.cache/chrome-devtools-mcp/chrome-profile-extension"

# Kill any stale Chrome instance using this profile and clean up
if pkill -f "${USER_DATA_DIR}" 2>/dev/null; then
  sleep 1
fi
rm -rf "${USER_DATA_DIR}"

exec npx chrome-devtools-mcp@latest \
  --executablePath="${CHROME_EXECUTABLE}" \
  --userDataDir="${USER_DATA_DIR}" \
  --ignoreDefaultChromeArg="--disable-extensions" \
  --chromeArg="--headless=new" \
  --chromeArg="--no-sandbox" \
  --chromeArg="--disable-dev-shm-usage" \
  --chromeArg="--disable-extensions-except=${EXTENSION_DIR}" \
  --chromeArg="--load-extension=${EXTENSION_DIR}"
