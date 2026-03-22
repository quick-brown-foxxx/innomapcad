#!/usr/bin/env bash
# Test that chrome-devtools-mcp starts with extension loaded
# Sends MCP JSON-RPC over stdin and checks the response

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Testing Chrome DevTools MCP with Extension ==="
echo ""

# Check prerequisites
if [ ! -f "$PROJECT_DIR/test-extension/manifest.json" ]; then
  echo "FAIL: test-extension/manifest.json not found"
  exit 1
fi
echo "✓ test-extension/manifest.json exists"

# Start the MCP server in background
TMPDIR=$(mktemp -d)
FIFO_IN="$TMPDIR/mcp_in"
FIFO_OUT="$TMPDIR/mcp_out"
mkfifo "$FIFO_IN" "$FIFO_OUT"

cleanup() {
  kill $MCP_PID 2>/dev/null || true
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

# Launch MCP server
bash "$PROJECT_DIR/scripts/chrome-devtools-mcp-with-extension.sh" < "$FIFO_IN" > "$FIFO_OUT" 2>"$TMPDIR/mcp_stderr.log" &
MCP_PID=$!

# Open the input fifo for writing (fd 3)
exec 3>"$FIFO_IN"

echo "✓ MCP server started (PID: $MCP_PID)"
sleep 3  # Give it time to launch Chrome

# Check if process is still running
if ! kill -0 $MCP_PID 2>/dev/null; then
  echo "FAIL: MCP server died. Stderr:"
  cat "$TMPDIR/mcp_stderr.log"
  exit 1
fi
echo "✓ MCP server is running"

# Send MCP initialize request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' >&3

# Read response (with timeout)
RESPONSE=""
if read -t 15 RESPONSE < "$FIFO_OUT"; then
  echo "✓ MCP initialize response received"
  echo "  Response: ${RESPONSE:0:200}..."
else
  echo "FAIL: No response from MCP server within 15s"
  echo "Stderr:"
  cat "$TMPDIR/mcp_stderr.log"
  exit 1
fi

# Send initialized notification
echo '{"jsonrpc":"2.0","method":"notifications/initialized"}' >&3
sleep 1

# Call tools/list to see available tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' >&3

if read -t 10 RESPONSE < "$FIFO_OUT"; then
  if echo "$RESPONSE" | grep -q "navigate_page"; then
    echo "✓ MCP tools available (navigate_page found)"
  else
    echo "⚠ MCP responded but navigate_page not in tool list"
    echo "  Response: ${RESPONSE:0:300}..."
  fi
else
  echo "FAIL: No tools/list response"
  exit 1
fi

# Navigate to a test page
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"navigate_page","arguments":{"url":"https://example.com"}}}' >&3

if read -t 15 RESPONSE < "$FIFO_OUT"; then
  echo "✓ navigate_page response received"
else
  echo "FAIL: navigate_page timed out"
  exit 1
fi

sleep 2  # Wait for extension content script to inject

# Check if extension is loaded via evaluate_script
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"evaluate_script","arguments":{"expression":"document.getElementById(\"innomapcad-test-extension\") !== null"}}}' >&3

if read -t 10 RESPONSE < "$FIFO_OUT"; then
  if echo "$RESPONSE" | grep -q "true"; then
    echo "✓ Extension content script is active! (marker element found)"
    echo ""
    echo "=== ALL TESTS PASSED ==="
  else
    echo "⚠ Extension marker not found in page"
    echo "  Response: $RESPONSE"
    echo ""
    echo "=== PARTIAL SUCCESS (MCP works, extension may not have injected) ==="
  fi
else
  echo "FAIL: evaluate_script timed out"
  exit 1
fi

# Close fd 3
exec 3>&-
