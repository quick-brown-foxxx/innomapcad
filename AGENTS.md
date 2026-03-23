# InnoMapCAD

Chrome Extension (Manifest V3) that injects GIS layers into the 4dinno.ru digital twin of Innopolis SEZ, plus a FastAPI backend for geo-validation. Hackathon project.

## ALWAYS READ docs/PHILOSOPHY.md 100% before writing any code.

---

## Architecture

```
Chrome Extension (Content Script)
  |
  |-- React fiber walk --> deck.gl instance on 4dinno.ru
  |       |
  |       +-- setProps() injects: cadastral layers, protection zones, placement layer
  |
  |-- Turf.js ----------> instant client-side validation
  |
  |-- HTTP (localhost:8000)
  |       |
  |       v
  |   FastAPI + Shapely (Python)
  |       |-- GET  /api/v1/layers/{slug}   -> GeoJSON FeatureCollection
  |       |-- GET  /api/v1/presets          -> building presets catalog
  |       +-- POST /api/v1/validate         -> Shapely geo-validation
  |
  +-- Floating UI Panel (shadow DOM, content script context)
        Preset selection, layer toggles, validation results
```

The extension finds the existing deck.gl instance by walking the React fiber tree from `#deckgl-overlay`, extracts `SolidPolygonLayer` from an existing sublayer, and injects custom layers via `deck.setProps()`. A MutationObserver re-injects layers after React re-renders.

---

## Directory Layout

```
backend/                # FastAPI + Shapely (Python 3.12, uv)
  src/
    main.py             # App entry, CORS, lifespan
    models.py           # Pydantic schemas
    routers/            # presets, layers, validate endpoints
    services/           # data_store (in-memory GeoJSON), validator (Shapely)
  tests/                # pytest (unit + TestClient)
  data/                 # Static GeoJSON files (cadastral, protection zones)
  Dockerfile

extension/              # Chrome Extension (React/TypeScript, pnpm, Vite)
  src/
    content.tsx         # Entry: waits for #deckgl-overlay, bootstraps injection
  manifest.json         # Manifest V3, content_scripts on 4dinno.ru/map/*
  tests/unit/           # Vitest (Turf.js validation, layer logic)

tests/e2e/              # Playwright e2e (extension on real 4dinno.ru + backend)
  fixtures/             # Playwright fixtures (persistent context, extension loading)
  helpers/              # Shared e2e utilities

docs/                   # Project documentation
  0.PRD.md              # Product requirements
  2.PLAN.PT1.md         # Implementation plan (original)
  2.PLAN.PT2.md         # Implementation plan (final, staged)
  PHILOSOPHY.md         # Coding philosophy (READ FIRST)

ralph/                  # Autonomous agent workflow

docker-compose.yml      # Backend container orchestration
playwright.config.ts    # Playwright config for e2e
package.json            # Root scripts (test:all, lint:all)
AGENTS.md               # This file (AI agent instructions)
CLAUDE.md -> AGENTS.md  # Symlink for Claude Code
```

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **React fiber walk** | Only way to access the existing deck.gl instance on 4dinno.ru; walk from `#deckgl-overlay.__reactFiber` to `ref.current.deck` |
| **Single `any` point** | The fiber walk is the one untyped boundary; a runtime type guard narrows immediately, rest of code is strict |
| **Shadow DOM for panel** | Isolates extension UI styles from the host page |
| **Result pattern** | Errors are values (`Result<T, E>`), not exceptions; forced handling at every call site |
| **Zustand stores** | Lightweight state management for layer visibility, selected preset, validation status |
| **deck.gl setProps bridge** | Patches `setProps` to always include custom layers; survives React re-renders via MutationObserver |
| **Shapely + pyproj UTM** | Server-side validation with metric precision (EPSG:32639 for Innopolis) |
| **In-memory GeoJSON** | No database; static files loaded at startup (hackathon scope) |

---

## Quality Commands

### Backend
```bash
cd backend
uv run ruff check         # Lint
uv run basedpyright       # Type check (strict)
uv run pytest -v          # Tests
```

### Extension
```bash
cd extension
pnpm lint                 # ESLint (strict-type-checked)
pnpm typecheck            # TypeScript strict
pnpm test                 # Vitest unit tests
pnpm build                # Production build
```

### Root (all stacks)
```bash
npm run test:all          # Run all tests (backend + extension)
npm run lint:all          # Run all linters (backend + extension)
```

---

## Testing Strategy

| Level | Tool | What | Where |
|-------|------|------|-------|
| Unit (Python) | pytest + Shapely | Geo-validation, endpoints via TestClient | `backend/tests/` |
| Unit (TS) | Vitest | Turf.js validation, layer formation, utilities | `extension/tests/unit/` |
| e2e (backend) | pytest + httpx | Real HTTP to running server | `backend/tests/e2e/` |
| e2e (extension) | Playwright | Extension on real 4dinno.ru | `tests/e2e/` |
| e2e (integration) | Playwright + docker-compose | Backend + extension + real site | `tests/e2e/` |

**Principles:**
- **Real > mocked** -- real Shapely, real GeoJSON, real HTTP, real site
- **e2e on real site** -- 4dinno.ru is the test target (hackathon, not mocked)
- **Tests = contract for AI agents** -- if tests are green, the code works
- **TDD** -- write tests first, implement to make them pass

---

## Key Patterns

- **Result pattern**: All expected failures return `Result<T, E>` / `Result[T, E]`. Exceptions are bugs only.
- **Zustand stores**: `useLayerStore` (visibility toggles), `usePresetStore` (selected preset), `useValidationStore` (status + conflicts).
- **deck.gl bridge**: `setProps` is patched to merge custom layers into every call. Bridge re-attaches via MutationObserver on DOM changes.
- **Fiber walk**: `document.querySelector('#deckgl-overlay')` -> `element[fiberKey]` -> walk `.return` chain -> `ref.current.deck`. Single `any` point, immediately narrowed by a type guard.
- **Boundary validation**: All external data (API responses, GeoJSON files, user clicks) validated with Zod (TS) / Pydantic (Python) at entry.

---

## GeoJSON Data

- **Coordinate system**: WGS-84 (matches 4dinno.ru digital twin)
- **Location**: Innopolis, Republic of Tatarstan, Russia (~48.74E, 55.75N)
- **Cadastral parcels** (`cadastral`): Real parcel boundaries from NSPD (nspd.gov.ru)
- **Protection zones** (`protection_zones`): ZOUIT registry -- gas pipelines, power lines, water protection zones
- **Format**: Static `.geojson` files in `backend/data/`, loaded into memory at startup
- **Zone types in features**: `gas_pipeline`, `power_line`, `water_protection` (in `properties.zone_type`)
