# Ralph — Autonomous Agent Loop

Ralph is an autonomous AI agent loop that implements features story-by-story from a PRD. Each iteration spawns a fresh AI instance with clean context. Memory persists through git history, `prd.yaml`, and `progress.txt`.

## How It Works

1. **Plan** — Create a PRD for your feature
2. **Convert** — Convert PRD to ralph format: use `/convert-prd-to-ralph` skill → outputs `ralph/current/prd.yaml`
3. **Customize prompt** — Copy `ralph/RALPH.md` → `ralph/current/RALPH.md`, edit project-specific section
4. **Run** — `./ralph/ralph.sh [--tool amp|claude] [max_iterations]`

## Directory Structure

```
ralph/
├── ralph.sh              # Main orchestration loop
├── yq.sh                 # yq wrapper (auto-downloads on first use)
├── RALPH.md              # Prompt template (don't edit for runs)
├── README.md             # This file
├── .bin/                 # Auto-downloaded binaries (gitignored)
├── current/              # Current run state (gitignored)
│   ├── RALPH.md          # Customized prompt for this run
│   ├── prd.yaml          # Feature PRD in YAML
│   └── progress.txt      # Append-only progress log
└── archive/              # Archived previous runs
    └── YYYY-MM-DD-name/
        ├── prd.yaml
        └── progress.txt
```

> **Note:** `yq` is auto-downloaded on first use -- no manual install needed.

## Usage

```bash
# Default: 10 iterations with claude
./ralph/ralph.sh

# Use amp instead
./ralph/ralph.sh --tool amp

# Limit to 5 iterations
./ralph/ralph.sh 5

# Amp with 20 iterations
./ralph/ralph.sh --tool amp 20
```

## PRD Format (prd.yaml)

```yaml
project: "My Feature"
branchName: "ralph/my-feature"
description: "What this feature does"
userStories:
  - id: "US-001"
    title: "Story title"
    description: "As a [user], I want..."
    acceptanceCriteria:
      - "Criterion 1"
      - "Typecheck passes"
    priority: 1
    passes: false
    notes: ""
```

## Key Design Decisions

- **Fresh context each iteration** — Each AI instance starts clean, reads state from files
- **YAML over JSON** — More readable, easier to edit manually
- **Append-only progress** — Never lose information from previous iterations
- **One story per iteration** — Keeps scope manageable within context window
- **Template-based prompt** — `RALPH.md` template customized per run in `current/`
