#!/usr/bin/env bash
#
# ralph.sh — Autonomous AI agent loop
# Adapted from snarktank/ralph for the InnoMapCAD project.
#
# Runs an AI tool (claude or amp) in a loop, feeding it ralph/current/RALPH.md
# as the prompt each iteration. Exits when the tool outputs "COMPLETE" or
# max iterations are reached.
#
# Usage:
#   ralph/ralph.sh [--tool claude|amp] [max_iterations]
#
# Examples:
#   ralph/ralph.sh                  # claude, 10 iterations
#   ralph/ralph.sh --tool amp 5     # amp, 5 iterations
#   ralph/ralph.sh 20               # claude, 20 iterations

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RALPH_DIR="$SCRIPT_DIR"
CURRENT_DIR="$RALPH_DIR/current"
ARCHIVE_DIR="$RALPH_DIR/archive"
TEMPLATE="$RALPH_DIR/RALPH.md"

# State files
PRD="$CURRENT_DIR/prd.yaml"
PROGRESS="$CURRENT_DIR/progress.txt"
LAST_BRANCH="$CURRENT_DIR/.last-branch"
PROMPT="$CURRENT_DIR/RALPH.md"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

TOOL="claude"
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tool)
            TOOL="$2"
            shift 2
            ;;
        *)
            MAX_ITERATIONS="$1"
            shift
            ;;
    esac
done

if [[ "$TOOL" != "claude" && "$TOOL" != "amp" ]]; then
    echo "Error: --tool must be 'claude' or 'amp' (got '$TOOL')"
    exit 1
fi

if ! [[ "$MAX_ITERATIONS" =~ ^[0-9]+$ ]]; then
    echo "Error: max_iterations must be a positive integer (got '$MAX_ITERATIONS')"
    exit 1
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Extract branchName from prd.yaml using local yq wrapper.
get_branch_name() {
    if [[ ! -f "$PRD" ]]; then
        echo ""
        return
    fi
    "$RALPH_DIR/yq.sh" '.branchName // ""' "$PRD" 2>/dev/null || echo ""
}

# Archive the current run into ralph/archive/YYYY-MM-DD-feature-name/
archive_current() {
    local branch_name="$1"
    local date_prefix
    date_prefix="$(date +%Y-%m-%d)"

    # Sanitize branch name for use as directory name
    local safe_name
    safe_name="$(echo "$branch_name" | tr '/' '-' | tr -cd '[:alnum:]-_')"

    local archive_dest="$ARCHIVE_DIR/${date_prefix}-${safe_name}"

    # Avoid overwriting an existing archive
    if [[ -d "$archive_dest" ]]; then
        archive_dest="${archive_dest}-$(date +%H%M%S)"
    fi

    echo "Archiving previous run to: $archive_dest"
    mkdir -p "$archive_dest"
    cp -r "$CURRENT_DIR"/* "$archive_dest"/ 2>/dev/null || true
    cp "$CURRENT_DIR"/.last-branch "$archive_dest"/ 2>/dev/null || true

    # Clean current state (keep directory)
    rm -f "$CURRENT_DIR/prd.yaml" \
          "$CURRENT_DIR/progress.txt" \
          "$CURRENT_DIR/.last-branch" \
          "$CURRENT_DIR/RALPH.md"
}

# Run the AI tool with RALPH.md as input, capture output.
run_tool() {
    case "$TOOL" in
        claude)
            claude --agent orchestrator --teammate-mode in-process --dangerously-skip-permissions --print < "$PROMPT"
            ;;
        amp)
            cat "$PROMPT" | amp --dangerously-allow-all
            ;;
    esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo "=== Ralph Agent Loop ==="
echo "Tool:           $TOOL"
echo "Max iterations: $MAX_ITERATIONS"
echo "Repo root:      $REPO_ROOT"
echo ""

# Always work from the repo root
cd "$REPO_ROOT"

# Ensure current/ and archive/ directories exist
mkdir -p "$CURRENT_DIR" "$ARCHIVE_DIR"

# Copy template RALPH.md to current/ if not already present
if [[ ! -f "$PROMPT" ]]; then
    if [[ ! -f "$TEMPLATE" ]]; then
        echo "Error: Template not found at $TEMPLATE"
        echo "Create ralph/RALPH.md before running this script."
        exit 1
    fi
    echo "Copying template RALPH.md to current/"
    cp "$TEMPLATE" "$PROMPT"
fi

# Check if branch changed since last run — archive if so
CURRENT_BRANCH="$(get_branch_name)"
PREVIOUS_BRANCH=""
if [[ -f "$LAST_BRANCH" ]]; then
    PREVIOUS_BRANCH="$(cat "$LAST_BRANCH")"
fi

if [[ -n "$PREVIOUS_BRANCH" && -n "$CURRENT_BRANCH" && "$PREVIOUS_BRANCH" != "$CURRENT_BRANCH" ]]; then
    echo "Branch changed: $PREVIOUS_BRANCH -> $CURRENT_BRANCH"
    archive_current "$PREVIOUS_BRANCH"

    # Re-copy template after archiving
    if [[ ! -f "$PROMPT" ]]; then
        cp "$TEMPLATE" "$PROMPT"
    fi
fi

# Record current branch
if [[ -n "$CURRENT_BRANCH" ]]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH"
fi

# ---------------------------------------------------------------------------
# Iteration loop
# ---------------------------------------------------------------------------

for (( i=1; i<=MAX_ITERATIONS; i++ )); do
    echo ""
    echo "=========================================="
    echo "  Iteration $i / $MAX_ITERATIONS"
    echo "=========================================="
    echo ""

    # Run the AI tool and capture output
    OUTPUT="$(run_tool 2>&1)" || true
    echo "$OUTPUT"

    # Log progress
    echo "--- Iteration $i ($(date '+%Y-%m-%d %H:%M:%S')) ---" >> "$PROGRESS"
    echo "$OUTPUT" >> "$PROGRESS"
    echo "" >> "$PROGRESS"

    # Update branch tracking (prd.yaml may have been created/changed)
    CURRENT_BRANCH="$(get_branch_name)"
    if [[ -n "$CURRENT_BRANCH" ]]; then
        echo "$CURRENT_BRANCH" > "$LAST_BRANCH"
    fi

    # Check for early completion
    if echo "$OUTPUT" | grep -q "COMPLETE"; then
        echo ""
        echo "=== COMPLETE detected in output. Stopping. ==="
        exit 0
    fi

    # Pause between iterations (skip after last)
    if (( i < MAX_ITERATIONS )); then
        sleep 2
    fi
done

echo ""
echo "=== Reached max iterations ($MAX_ITERATIONS). Stopping. ==="
exit 0
