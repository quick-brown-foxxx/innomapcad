# InnoMapCAD

A Chrome Extension that augments the [4dinno.ru](https://4dinno.ru/map/territory) digital twin of Innopolis Special Economic Zone with GIS layers (cadastral parcels, protection zones) and interactive building placement with instant geo-validation -- enabling urban planners to verify whether a proposed building placement complies with zoning and protection regulations directly on the 3D map.

## Architecture

```
+----------------------------------------------+
|  Chrome Extension (Manifest V3)              |
|                                              |
|  Content Script          Floating UI Panel   |
|  - React fiber walk      - Preset selector   |
|  - deck.gl layer inject  - Layer toggles     |
|  - Turf.js validation    - Validation result |
+--------+-------------------+-----------------+
         |  setProps()       |
         v                   |  HTTP :8000
+------------------+         v
| 4dinno.ru/map    |  +--------------------+
| deck.gl instance |  | FastAPI + Shapely  |
+------------------+  | GeoJSON in memory  |
                      +--------------------+
```

## Quick Start

### Prerequisites

- Chrome browser
- Python 3.12+
- Node.js 20+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (Node package manager)
- Docker & Docker Compose (optional, for containerized backend)

### Setup

```bash
# Clone
git clone https://github.com/quick-brown-foxxx/innomapcad.git
cd innomapcad

# Backend
cd backend
uv sync
cd ..

# Extension
cd extension
pnpm install
cd ..
```

### Run

**1. Start the backend:**
```bash
cd backend
uv run uvicorn src.main:app --reload --port 8000
# Or with Docker:
docker compose up backend
```

**2. Build the extension:**
```bash
cd extension
pnpm build
```

**3. Load in Chrome:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `extension/dist/`
4. Navigate to [4dinno.ru/map/territory](https://4dinno.ru/map/territory)

## Demo Scenario

1. Open 4dinno.ru/map/territory in Chrome -- the extension auto-injects cadastral parcels (blue polygons) and protection zones (red semi-transparent areas) onto the 3D map
2. Select a building preset (e.g., "Residential building") from the floating panel
3. Click on the map -- the building appears as an extruded polygon
4. Turf.js instantly highlights conflicts: red outline if intersecting a protection zone, green if clear
5. Click "Validate" -- the backend confirms via Shapely with a detailed conflict report

See the full product requirements in [docs/0.PRD.md](docs/0.PRD.md) and the implementation plan in [docs/2.PLAN.PT2.md](docs/2.PLAN.PT2.md).

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Extension | Chrome Manifest V3, React, TypeScript, deck.gl, Turf.js, Zustand |
| Backend | FastAPI, Shapely, Pydantic, Python 3.12 |
| Data | Static GeoJSON (WGS-84), in-memory |
| Testing | Vitest, Playwright, pytest |
| Tooling | uv, pnpm, ruff, basedpyright, ESLint |

## License

Hackathon project -- Innopolis SEZ case.
