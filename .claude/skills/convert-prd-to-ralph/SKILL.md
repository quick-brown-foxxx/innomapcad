---
name: convert-prd-to-ralph
description: Convert a markdown PRD into ralph's prd.yaml format for autonomous execution. triggers - "convert this prd", "turn this into ralph format", "create prd.yaml from this", "ralph yaml", "convert prd to ralph"
---

# Convert PRD to Ralph Format

Convert a markdown PRD document into `ralph/current/prd.yaml` for the ralph autonomous agent loop.

## Instructions

1. **Find the PRD** — Look for the PRD the user references. Check `docs/` directory or the file they specify.

2. **Extract user stories** — Parse the PRD for user stories, requirements, and acceptance criteria.

3. **Generate prd.yaml** — Create `ralph/current/prd.yaml` with this structure:

```yaml
project: "<Project/Feature Name>"
branchName: "ralph/<kebab-case-feature-name>"
description: "<1-2 sentence description>"
userStories:
  - id: "US-001"
    title: "<Story title>"
    description: "As a <user>, I want <goal> so that <benefit>"
    acceptanceCriteria:
      - "<Specific, verifiable criterion>"
      - "Typecheck passes"
    priority: 1
    passes: false
    notes: ""
```

## Rules

- **Story sizing** — Each story MUST be completable in ONE context window. If a story is too large, split it
- **Dependency order** — Priority determines execution order. Lower number = higher priority. Order: schema → backend → core logic → UI → integration
- **Every story** must include "Typecheck passes" in acceptance criteria
- **UI stories** must include "Verify in browser" in acceptance criteria
- **Acceptance criteria must be verifiable** — Not vague. "Works correctly" is bad. "Returns 200 with JSON body containing `id` field" is good
- **No gaps** — Stories should cover the complete feature. Nothing should be left unspecified
- `passes` always starts as `false`
- `notes` always starts as `""`

4. **Copy prompt template** — If `ralph/current/RALPH.md` doesn't exist, copy from `ralph/RALPH.md`

5. **Confirm** — Show the user the generated YAML and ask if stories need adjustment before running ralph
