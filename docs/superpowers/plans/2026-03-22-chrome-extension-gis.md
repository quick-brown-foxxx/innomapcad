# Chrome Extension ГИС-САПР Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome Extension that injects GIS layers (cadastral parcels, protection zones) and interactive building placement with validation into the 4dinno.ru digital twin.

**Architecture:** Chrome Extension (Manifest V3) content script injects into 4dinno.ru/map/*, adds deck.gl layers and floating UI panel. Lightweight FastAPI + Shapely backend provides server-side validation and serves GeoJSON data. Turf.js handles client-side visual feedback.

**Tech Stack:** Chrome Extension (Manifest V3), deck.gl, Turf.js, FastAPI, Shapely, Pydantic, Docker

**Spec:** `docs/superpowers/specs/2026-03-22-chrome-extension-gis-design.md`
**3D Integration Reference:** `docs/3D_BUILDINGS_INTEGRATION.md`

---

## File Structure

```
/
├── extension/                      # Chrome Extension (Manifest V3)
│   ├── manifest.json               # Extension manifest
│   ├── content.js                  # Main content script — orchestrates injection
│   ├── injected.js                 # Page-context script (access to window.deck)
│   ├── ui/
│   │   ├── panel.js                # Floating UI panel (layers, presets, validation)
│   │   └── panel.css               # Panel styles
│   ├── layers/
│   │   ├── deck-bridge.js          # deck.gl instance access + layer injection
│   │   ├── cadastral-layer.js      # Cadastral parcels GeoJsonLayer
│   │   ├── zones-layer.js          # Protection zones GeoJsonLayer
│   │   └── placement-layer.js      # Building placement + setback buffer layers
│   ├── validation/
│   │   ├── client-validator.js     # Turf.js client-side validation
│   │   └── server-validator.js     # Backend API calls
│   ├── data/
│   │   ├── presets.json            # 5 building presets
│   │   ├── cadastral.geojson       # Cadastral parcels (hardcoded data)
│   │   └── protection_zones.geojson # Protection zones (hardcoded data)
│   └── lib/
│       └── turf.min.js             # Turf.js bundle (vendored)
│
├── backend/                        # FastAPI + Shapely
│   ├── main.py                     # FastAPI app, CORS, startup data loading
│   ├── routers/
│   │   ├── validate.py             # POST /api/v1/validate
│   │   ├── layers.py               # GET /api/v1/layers/{slug}
│   │   └── presets.py              # GET /api/v1/presets
│   ├── services/
│   │   ├── validator.py            # Shapely validation logic
│   │   └── data_store.py           # In-memory GeoJSON store
│   ├── models.py                   # Pydantic request/response schemas
│   ├── data/
│   │   ├── cadastral.geojson       # Same data as extension (symlink or copy)
│   │   └── protection_zones.geojson
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml              # Backend only (one service)
├── data/                           # Source data (shared, copied to extension/backend)
│   ├── cadastral.geojson
│   └── protection_zones.geojson
└── scripts/
    └── fetch_nspd_data.py          # Script to download data from NSPD
```

---

## Task 0: Data Preparation (Manual/Script)

**Goal:** Get real GeoJSON data for Innopolis territory.

**Files:**
- Create: `scripts/fetch_nspd_data.py`
- Create: `data/cadastral.geojson`
- Create: `data/protection_zones.geojson`

This task is semi-manual — fetch data from НСПД (nspd.gov.ru) for the Innopolis OEZ bbox. If API is unreliable, manually export from the public cadastral map.

- [ ] **Step 1: Create data fetch script**

```python
# scripts/fetch_nspd_data.py
"""
Fetch cadastral parcels and protection zones from NSPD for Innopolis OEZ.
Bbox: approximately [48.70, 55.72, 48.80, 55.78] (lon_min, lat_min, lon_max, lat_max)
"""
import json
import requests

INNOPOLIS_BBOX = [48.70, 55.72, 48.80, 55.78]

def fetch_cadastral_parcels():
    """
    Fetch cadastral parcels from NSPD WFS/API.
    Fallback: use manually exported GeoJSON.
    """
    # NSPD API endpoint for cadastral parcels search by bbox
    # Docs: docs/DATA_SOURCES.md section on NSPD
    url = "https://nspd.gov.ru/api/geoportal/v2/search/geoportal"
    params = {
        "bbox": ",".join(map(str, INNOPOLIS_BBOX)),
        "limit": 500,
        "type": "parcel"
    }
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"NSPD API failed: {e}")
        print("Use manual export from https://nspd.gov.ru/ instead")
        return None

def fetch_protection_zones():
    """
    Fetch ZOUIT (protection zones) from NSPD.
    Fallback: create mock data for demo.
    """
    url = "https://nspd.gov.ru/api/geoportal/v2/search/geoportal"
    params = {
        "bbox": ",".join(map(str, INNOPOLIS_BBOX)),
        "limit": 500,
        "type": "zouit"
    }
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"NSPD ZOUIT API failed: {e}")
        print("Will create mock protection zones")
        return None

def create_mock_protection_zones():
    """Create realistic mock protection zones for Innopolis demo."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Охранная зона газопровода",
                    "type": "gas_pipeline",
                    "restriction": "Запрет капитального строительства"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[48.745, 55.752], [48.750, 55.752],
                                     [48.750, 55.754], [48.745, 55.754],
                                     [48.745, 55.752]]]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Охранная зона ЛЭП",
                    "type": "power_line",
                    "restriction": "Запрет строительства в 25м от оси"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[48.740, 55.748], [48.755, 55.748],
                                     [48.755, 55.749], [48.740, 55.749],
                                     [48.740, 55.748]]]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "name": "Водоохранная зона",
                    "type": "water_protection",
                    "restriction": "Ограничение хозяйственной деятельности"
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[48.735, 55.745], [48.742, 55.745],
                                     [48.742, 55.755], [48.735, 55.755],
                                     [48.735, 55.745]]]
                }
            }
        ]
    }

if __name__ == "__main__":
    print("Fetching cadastral parcels...")
    cadastral = fetch_cadastral_parcels()
    if cadastral:
        with open("data/cadastral.geojson", "w") as f:
            json.dump(cadastral, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(cadastral.get('features', []))} parcels")
    else:
        print("⚠️  Manual export required for cadastral data")

    print("\nFetching protection zones...")
    zones = fetch_protection_zones()
    if not zones:
        print("Using mock protection zones")
        zones = create_mock_protection_zones()
    with open("data/protection_zones.geojson", "w") as f:
        json.dump(zones, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(zones.get('features', []))} zones")
```

- [ ] **Step 2: Create data directory and run script**

```bash
mkdir -p data
pip install requests
python scripts/fetch_nspd_data.py
```

Expected: `data/cadastral.geojson` and `data/protection_zones.geojson` created. If NSPD API fails, manually export from nspd.gov.ru and place GeoJSON files in `data/`.

- [ ] **Step 3: Verify data files are valid GeoJSON**

```bash
python -c "import json; d=json.load(open('data/cadastral.geojson')); print(f'Cadastral: {len(d[\"features\"])} features')"
python -c "import json; d=json.load(open('data/protection_zones.geojson')); print(f'Zones: {len(d[\"features\"])} features')"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch_nspd_data.py data/
git commit -m "feat: add data preparation script and GeoJSON data for Innopolis"
```

---

## Task 1: Backend — Project Skeleton + Health Endpoint

**Goal:** FastAPI app that starts, serves health endpoint, loads GeoJSON at startup.

**Files:**
- Create: `backend/main.py`
- Create: `backend/services/data_store.py`
- Create: `backend/models.py`
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `docker-compose.yml`
- Test: `backend/tests/test_health.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
shapely==2.0.6
pyproj==3.6.1
pydantic==2.9.0
geojson-pydantic==1.1.1
pytest==8.3.0
httpx==0.27.0
```

- [ ] **Step 2: Write failing test for health endpoint**

Create `backend/tests/__init__.py` (empty) and `backend/tests/test_health.py`:

```python
# backend/tests/test_health.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_health_returns_ok():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && pip install -r requirements.txt && python -m pytest tests/test_health.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 4: Create data_store.py**

```python
# backend/services/data_store.py
"""In-memory GeoJSON data store. Loads files at startup."""
import json
from pathlib import Path
from shapely.geometry import shape

class DataStore:
    def __init__(self):
        self.layers: dict[str, dict] = {}  # slug -> GeoJSON FeatureCollection
        self.shapes: dict[str, list] = {}  # slug -> list of Shapely geometries

    def load(self, data_dir: str = "data"):
        """Load all GeoJSON files from data directory."""
        data_path = Path(data_dir)
        for filepath in data_path.glob("*.geojson"):
            slug = filepath.stem  # e.g. "cadastral", "protection_zones"
            with open(filepath) as f:
                geojson = json.load(f)
            self.layers[slug] = geojson
            self.shapes[slug] = [
                shape(feature["geometry"])
                for feature in geojson.get("features", [])
            ]
            print(f"Loaded layer '{slug}': {len(self.shapes[slug])} features")

    def get_layer(self, slug: str) -> dict | None:
        return self.layers.get(slug)

    def get_shapes(self, slug: str) -> list:
        return self.shapes.get(slug, [])

store = DataStore()
```

- [ ] **Step 5: Create models.py**

```python
# backend/models.py
"""Pydantic request/response schemas."""
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    layers_loaded: int

class Conflict(BaseModel):
    layer: str
    type: str
    description: str

class ValidateRequest(BaseModel):
    geometry: dict  # GeoJSON geometry
    preset_slug: str

class ValidateResponse(BaseModel):
    valid: bool
    conflicts: list[Conflict]

class Preset(BaseModel):
    slug: str
    name: str
    width_m: float
    length_m: float
    floors: int
    height_m: float
    setback_m: float
    color: str
```

- [ ] **Step 6: Create main.py**

```python
# backend/main.py
"""Lightweight GIS validation backend. No database — all data in memory."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.data_store import store
from models import HealthResponse

import os
@asynccontextmanager
async def lifespan(app: FastAPI):
    data_dir = os.environ.get("DATA_DIR", "data")
    store.load(data_dir)
    yield

app = FastAPI(title="InnoMapCAD API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://4dinno.ru"],
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", layers_loaded=len(store.layers))
```

- [ ] **Step 7: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_health.py -v
```

Expected: PASS

- [ ] **Step 8: Create Dockerfile and docker-compose.yml**

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data:ro
    environment:
      - PYTHONUNBUFFERED=1
```

- [ ] **Step 9: Verify Docker build**

```bash
docker compose build backend
```

Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add backend/ docker-compose.yml
git commit -m "feat: backend skeleton with health endpoint and in-memory data store"
```

---

## Task 2: Backend — Presets Endpoint

**Goal:** `GET /api/v1/presets` returns the 5 building presets.

**Files:**
- Create: `backend/routers/__init__.py`
- Create: `backend/routers/presets.py`
- Modify: `backend/main.py` (register router)
- Test: `backend/tests/test_presets.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_presets.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_presets_returns_five_items():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert len(presets) == 5
    slugs = {p["slug"] for p in presets}
    assert slugs == {"residential", "office", "transformer", "parking", "warehouse"}

@pytest.mark.asyncio
async def test_preset_has_required_fields():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/presets")
    preset = resp.json()[0]
    required = {"slug", "name", "width_m", "length_m", "floors", "height_m", "setback_m", "color"}
    assert required.issubset(set(preset.keys()))
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_presets.py -v
```

Expected: FAIL — 404

- [ ] **Step 3: Create presets router**

```python
# backend/routers/presets.py
from fastapi import APIRouter
from models import Preset

router = APIRouter(prefix="/api/v1", tags=["presets"])

PRESETS = [
    Preset(slug="residential", name="Жилое здание", width_m=30, length_m=15,
           floors=5, height_m=15, setback_m=10, color="#4A90D9"),
    Preset(slug="office", name="Офисное здание", width_m=40, length_m=20,
           floors=3, height_m=12, setback_m=8, color="#5BC0DE"),
    Preset(slug="transformer", name="Трансформаторная подстанция", width_m=6, length_m=4,
           floors=1, height_m=3, setback_m=15, color="#F0AD4E"),
    Preset(slug="parking", name="Парковка", width_m=25, length_m=15,
           floors=1, height_m=0, setback_m=3, color="#999999"),
    Preset(slug="warehouse", name="Склад", width_m=30, length_m=20,
           floors=1, height_m=6, setback_m=5, color="#8B6914"),
]

@router.get("/presets", response_model=list[Preset])
async def get_presets():
    return PRESETS
```

- [ ] **Step 4: Register router in main.py**

Add to `backend/main.py` after CORS middleware:

```python
from routers.presets import router as presets_router
app.include_router(presets_router)
```

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/ backend/tests/test_presets.py backend/main.py
git commit -m "feat: add GET /api/v1/presets endpoint with 5 building presets"
```

---

## Task 3: Backend — Layers Endpoint

**Goal:** `GET /api/v1/layers/{slug}` returns GeoJSON from the in-memory store.

**Files:**
- Create: `backend/routers/layers.py`
- Modify: `backend/main.py` (register router)
- Test: `backend/tests/test_layers.py`

- [ ] **Step 1: Create a tiny test fixture GeoJSON**

```python
# backend/tests/conftest.py
import pytest
import json
import os
from httpx import AsyncClient, ASGITransport

@pytest.fixture(autouse=True)
def setup_test_data(tmp_path, monkeypatch):
    """Create minimal test GeoJSON files before each test."""
    cadastral = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"cadnum": "16:50:000000:1"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[48.74, 55.75], [48.75, 55.75],
                                 [48.75, 55.76], [48.74, 55.76],
                                 [48.74, 55.75]]]
            }
        }]
    }
    zones = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {"name": "Test zone", "type": "gas_pipeline"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[48.745, 55.752], [48.750, 55.752],
                                 [48.750, 55.754], [48.745, 55.754],
                                 [48.745, 55.752]]]
            }
        }]
    }
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "cadastral.geojson").write_text(json.dumps(cadastral))
    (data_dir / "protection_zones.geojson").write_text(json.dumps(zones))

    # Set env var so main.py lifespan uses test data
    monkeypatch.setenv("DATA_DIR", str(data_dir))

    from services.data_store import store
    store.layers.clear()
    store.shapes.clear()
    store.load(str(data_dir))
```

- [ ] **Step 2: Write failing test**

```python
# backend/tests/test_layers.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_get_cadastral_layer():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/layers/cadastral")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 1

@pytest.mark.asyncio
async def test_get_unknown_layer_returns_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/layers/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 3: Run to verify failure**

```bash
cd backend && python -m pytest tests/test_layers.py -v
```

Expected: FAIL — 404

- [ ] **Step 4: Create layers router**

```python
# backend/routers/layers.py
from fastapi import APIRouter, HTTPException
from services.data_store import store

router = APIRouter(prefix="/api/v1", tags=["layers"])

@router.get("/layers/{slug}")
async def get_layer(slug: str):
    layer = store.get_layer(slug)
    if layer is None:
        raise HTTPException(status_code=404, detail=f"Layer '{slug}' not found")
    return layer
```

- [ ] **Step 5: Register router in main.py**

```python
from routers.layers import router as layers_router
app.include_router(layers_router)
```

- [ ] **Step 6: Run all tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add GET /api/v1/layers/{slug} endpoint for GeoJSON data"
```

---

## Task 4: Backend — Validation Endpoint

**Goal:** `POST /api/v1/validate` checks geometry against all loaded layers using Shapely.

**Files:**
- Create: `backend/services/validator.py`
- Create: `backend/routers/validate.py`
- Modify: `backend/main.py` (register router)
- Test: `backend/tests/test_validate.py`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_validate.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

# A polygon INSIDE the test protection zone (should conflict)
CONFLICTING_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[[48.746, 55.7525], [48.748, 55.7525],
                     [48.748, 55.7535], [48.746, 55.7535],
                     [48.746, 55.7525]]]
}

# A polygon INSIDE the cadastral parcel but OUTSIDE the protection zone (should be valid)
SAFE_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[[48.741, 55.751], [48.743, 55.751],
                     [48.743, 55.7515], [48.741, 55.7515],
                     [48.741, 55.751]]]
}

@pytest.mark.asyncio
async def test_validate_detects_intersection_conflict():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/validate", json={
            "geometry": CONFLICTING_GEOMETRY,
            "preset_slug": "residential"
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is False
    assert len(data["conflicts"]) > 0
    assert data["conflicts"][0]["layer"] == "protection_zones"

@pytest.mark.asyncio
async def test_validate_passes_for_safe_location():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/validate", json={
            "geometry": SAFE_GEOMETRY,
            "preset_slug": "parking"
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert len(data["conflicts"]) == 0
```

- [ ] **Step 2: Run to verify failure**

```bash
cd backend && python -m pytest tests/test_validate.py -v
```

Expected: FAIL — 404 (or 405)

- [ ] **Step 3: Create validator service**

```python
# backend/services/validator.py
"""Shapely-based spatial validation."""
from shapely.geometry import shape, mapping
from services.data_store import store
from models import Conflict

from routers.presets import PRESETS
# Build setback lookup from presets
PRESET_SETBACKS = {p.slug: p.setback_m for p in PRESETS}

def validate_placement(geometry: dict, preset_slug: str) -> list[Conflict]:
    """
    Check placement geometry against all restriction layers.
    Returns list of conflicts (empty = valid placement).
    """
    conflicts = []
    try:
        obj_shape = shape(geometry)
    except Exception:
        return [Conflict(layer="input", type="invalid_geometry",
                         description="Invalid GeoJSON geometry")]

    if not obj_shape.is_valid:
        return [Conflict(layer="input", type="invalid_geometry",
                         description="Geometry is not valid")]

    # Check 1: Intersection with protection zones
    for i, zone_shape in enumerate(store.get_shapes("protection_zones")):
        if obj_shape.intersects(zone_shape):
            # Get zone name from GeoJSON properties
            zone_data = store.get_layer("protection_zones")
            props = zone_data["features"][i].get("properties", {})
            zone_name = props.get("name", f"Охранная зона #{i+1}")
            conflicts.append(Conflict(
                layer="protection_zones",
                type="intersection",
                description=f"Пересечение с: {zone_name}"
            ))

    # Check 2: Setback buffer intersections with protection zones
    setback = PRESET_SETBACKS.get(preset_slug, 5)
    if setback > 0:
        # Use UTM zone 39N (EPSG:32639) for accurate metric buffering near Innopolis
        from pyproj import Transformer
        transformer_to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32639", always_xy=True)
        transformer_to_wgs = Transformer.from_crs("EPSG:32639", "EPSG:4326", always_xy=True)
        from shapely.ops import transform
        obj_utm = transform(transformer_to_utm.transform, obj_shape)
        buffered_utm = obj_utm.buffer(setback)
        buffered = transform(transformer_to_wgs.transform, buffered_utm)
        for i, zone_shape in enumerate(store.get_shapes("protection_zones")):
            if buffered.intersects(zone_shape) and not obj_shape.intersects(zone_shape):
                zone_data = store.get_layer("protection_zones")
                props = zone_data["features"][i].get("properties", {})
                zone_name = props.get("name", f"Охранная зона #{i+1}")
                conflicts.append(Conflict(
                    layer="protection_zones",
                    type="setback_violation",
                    description=f"Нарушение отступа {setback}м от: {zone_name}"
                ))

    # Check 3: Within cadastral parcel boundary
    cadastral_shapes = store.get_shapes("cadastral")
    if cadastral_shapes:
        within_any = any(obj_shape.within(parcel) for parcel in cadastral_shapes)
        if not within_any:
            conflicts.append(Conflict(
                layer="cadastral",
                type="outside_boundary",
                description="Объект не находится внутри кадастрового участка"
            ))

    return conflicts
```

- [ ] **Step 4: Create validate router**

```python
# backend/routers/validate.py
from fastapi import APIRouter
from models import ValidateRequest, ValidateResponse
from services.validator import validate_placement

router = APIRouter(prefix="/api/v1", tags=["validation"])

@router.post("/validate", response_model=ValidateResponse)
async def validate(request: ValidateRequest):
    conflicts = validate_placement(request.geometry, request.preset_slug)
    return ValidateResponse(valid=len(conflicts) == 0, conflicts=conflicts)
```

- [ ] **Step 5: Register router in main.py**

```python
from routers.validate import router as validate_router
app.include_router(validate_router)
```

- [ ] **Step 6: Run all tests**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add POST /api/v1/validate endpoint with Shapely intersection checks"
```

---

## Task 5: Chrome Extension — Manifest + Content Script Skeleton

**Goal:** Extension loads on 4dinno.ru, injects a page-context script, shows a basic panel.

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/content.js`
- Create: `extension/injected.js`
- Create: `extension/data/presets.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "InnoMapCAD",
  "version": "0.1.0",
  "description": "ГИС-САПР overlay for Innopolis digital twin",
  "content_scripts": [{
    "matches": ["*://4dinno.ru/map/*"],
    "js": ["content.js"],
    "css": ["ui/panel.css"],
    "run_at": "document_idle"
  }],
  "host_permissions": [
    "https://4dinno.ru/*",
    "http://localhost:8000/*"
  ],
  "web_accessible_resources": [{
    "resources": ["injected.js", "data/*", "lib/*"],
    "matches": ["*://4dinno.ru/*"]
  }]
}
```

- [ ] **Step 2: Create presets.json**

```json
[
  {"slug": "residential", "name": "Жилое здание", "width_m": 30, "length_m": 15, "floors": 5, "height_m": 15, "setback_m": 10, "color": "#4A90D9"},
  {"slug": "office", "name": "Офисное здание", "width_m": 40, "length_m": 20, "floors": 3, "height_m": 12, "setback_m": 8, "color": "#5BC0DE"},
  {"slug": "transformer", "name": "ТП", "width_m": 6, "length_m": 4, "floors": 1, "height_m": 3, "setback_m": 15, "color": "#F0AD4E"},
  {"slug": "parking", "name": "Парковка", "width_m": 25, "length_m": 15, "floors": 1, "height_m": 0, "setback_m": 3, "color": "#999999"},
  {"slug": "warehouse", "name": "Склад", "width_m": 30, "length_m": 20, "floors": 1, "height_m": 6, "setback_m": 5, "color": "#8B6914"}
]
```

- [ ] **Step 3: Create content.js — the orchestrator**

```javascript
// extension/content.js
// Runs in content script context. Injects page-context script and UI panel.
(function() {
  'use strict';

  const BACKEND_URL = 'http://localhost:8000';

  // Inject the page-context script (needs access to window.deck)
  function injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.dataset.backendUrl = BACKEND_URL;
    script.dataset.extensionId = chrome.runtime.id;
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }

  // Wait for the map container to be ready
  function waitForMap() {
    return new Promise((resolve) => {
      const check = () => {
        const overlay = document.querySelector('#deckgl-overlay');
        if (overlay) {
          resolve(overlay);
        } else {
          setTimeout(check, 500);
        }
      };
      check();
    });
  }

  async function init() {
    console.log('[InnoMapCAD] Waiting for map...');
    await waitForMap();
    console.log('[InnoMapCAD] Map found, injecting...');
    injectPageScript();
  }

  init();
})();
```

- [ ] **Step 4: Create injected.js — page context stub**

```javascript
// extension/injected.js
// Runs in PAGE context — has access to window.deck, deck.gl instances.
// This is the main entry point for all deck.gl layer manipulation.
(function() {
  'use strict';

  const BACKEND_URL = document.currentScript?.dataset?.backendUrl || 'http://localhost:8000';
  const EXTENSION_ID = document.currentScript?.dataset?.extensionId || '';

  console.log('[InnoMapCAD] Page script loaded, backend:', BACKEND_URL);

  // --- deck.gl Bridge ---
  function getDeckInstance() {
    const overlay = document.querySelector('#deckgl-overlay');
    if (!overlay) return null;
    const fiberKey = Object.keys(overlay).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return null;
    try {
      return overlay[fiberKey].return.return.ref.current.deck;
    } catch (e) {
      console.error('[InnoMapCAD] Failed to get deck instance:', e);
      return null;
    }
  }

  function getSolidPolygonLayerClass(deck) {
    const allLayers = deck.layerManager.getLayers();
    const bldLayer = allLayers.find(l => l.id === 'background-layerTerrain3D-bld');
    return bldLayer ? bldLayer.constructor : null;
  }

  // --- Initialization ---
  function waitForDeck(timeout = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const deck = getDeckInstance();
        if (deck) {
          resolve(deck);
        } else if (Date.now() - start > timeout) {
          reject(new Error('deck.gl instance not found within timeout'));
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }

  async function init() {
    try {
      const deck = await waitForDeck();
      console.log('[InnoMapCAD] deck.gl instance found');

      const SolidPolygonLayer = getSolidPolygonLayerClass(deck);
      if (SolidPolygonLayer) {
        console.log('[InnoMapCAD] SolidPolygonLayer class extracted');
      }

      // Store references globally for other modules
      window.__innomapcad = {
        deck,
        SolidPolygonLayer,
        backendUrl: BACKEND_URL,
        customLayers: [],
      };

      // Notify content script that we're ready
      window.dispatchEvent(new CustomEvent('innomapcad:ready'));

    } catch (e) {
      console.error('[InnoMapCAD] Initialization failed:', e.message);
      window.dispatchEvent(new CustomEvent('innomapcad:error', { detail: e.message }));
    }
  }

  init();
})();
```

- [ ] **Step 5: Test manually — load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/` folder
4. Navigate to `https://4dinno.ru/map/territory`
5. Open DevTools Console
6. Expected: `[InnoMapCAD] Map found, injecting...` and `[InnoMapCAD] deck.gl instance found`

- [ ] **Step 6: Commit**

```bash
git add extension/
git commit -m "feat: Chrome Extension skeleton with deck.gl bridge and content script"
```

---

## Task 6: Chrome Extension — deck.gl Layer Injection (Cadastral + Zones)

**Goal:** Load GeoJSON data and render cadastral parcels and protection zones as deck.gl layers.

**Files:**
- Create: `extension/layers/deck-bridge.js`
- Create: `extension/layers/cadastral-layer.js`
- Create: `extension/layers/zones-layer.js`
- Modify: `extension/injected.js` (import and use layers)
- Copy: `data/*.geojson` → `extension/data/`

- [ ] **Step 1: Copy data files into extension**

```bash
cp data/cadastral.geojson extension/data/
cp data/protection_zones.geojson extension/data/
```

- [ ] **Step 2: Create deck-bridge.js**

```javascript
// extension/layers/deck-bridge.js
// Manages deck.gl layer injection and React re-render resilience.
(function() {
  'use strict';

  const bridge = {
    deck: null,
    customLayers: [],
    originalSetProps: null,

    init(deckInstance) {
      this.deck = deckInstance;

      // Patch setProps to always include our layers
      this.originalSetProps = this.deck.setProps.bind(this.deck);
      this.deck.setProps = (props) => {
        if (props.layers) {
          props.layers = [...props.layers, ...this.customLayers];
        }
        this.originalSetProps(props);
      };
    },

    addLayer(layer) {
      this.customLayers.push(layer);
      this._refresh();
    },

    removeLayer(layerId) {
      this.customLayers = this.customLayers.filter(l => l.props.id !== layerId);
      this._refresh();
    },

    updateLayer(layerId, newLayer) {
      this.customLayers = this.customLayers.map(l =>
        l.props.id === layerId ? newLayer : l
      );
      this._refresh();
    },

    _refresh() {
      if (!this.deck) return;
      const existingLayers = this.deck.props.layers.filter(
        l => !this.customLayers.find(cl => cl.props.id === l.props.id)
      );
      this.originalSetProps({
        layers: [...existingLayers, ...this.customLayers]
      });
    }
  };

  window.__innomapcad_bridge = bridge;
})();
```

- [ ] **Step 3: Create cadastral-layer.js**

```javascript
// extension/layers/cadastral-layer.js
// Creates a GeoJsonLayer for cadastral parcels.
(function() {
  'use strict';

  function createCadastralLayer(GeoJsonLayerClass, data) {
    return new GeoJsonLayerClass({
      id: 'innomapcad-cadastral',
      data: data,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: [74, 144, 217, 40],    // Blue, semi-transparent
      getLineColor: [74, 144, 217, 180],   // Blue, more opaque
      getLineWidth: 2,
      lineWidthMinPixels: 1,
    });
  }

  window.__innomapcad_createCadastralLayer = createCadastralLayer;
})();
```

- [ ] **Step 4: Create zones-layer.js**

```javascript
// extension/layers/zones-layer.js
// Creates a GeoJsonLayer for protection zones.
(function() {
  'use strict';

  function createZonesLayer(GeoJsonLayerClass, data) {
    return new GeoJsonLayerClass({
      id: 'innomapcad-zones',
      data: data,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: [220, 53, 69, 60],     // Red, semi-transparent
      getLineColor: [220, 53, 69, 200],    // Red, opaque
      getLineWidth: 2,
      lineWidthMinPixels: 1,
      lineWidthScale: 1,
    });
  }

  window.__innomapcad_createZonesLayer = createZonesLayer;
})();
```

- [ ] **Step 5: Update injected.js — load data and create layers**

Replace the `init()` function in `injected.js`:

```javascript
  async function init() {
    try {
      const deck = await waitForDeck();
      console.log('[InnoMapCAD] deck.gl instance found');

      // Get layer class — try GeoJsonLayer from existing layers
      const allLayers = deck.layerManager.getLayers();
      let GeoJsonLayerClass = null;
      const SolidPolygonLayer = getSolidPolygonLayerClass(deck);

      // Find a GeoJsonLayer from existing layers or use from deck namespace
      for (const layer of allLayers) {
        if (layer.constructor.layerName === 'GeoJsonLayer') {
          GeoJsonLayerClass = layer.constructor;
          break;
        }
      }

      // Store references
      window.__innomapcad = {
        deck,
        SolidPolygonLayer,
        GeoJsonLayerClass,
        backendUrl: BACKEND_URL,
      };

      // Initialize bridge
      if (window.__innomapcad_bridge) {
        window.__innomapcad_bridge.init(deck);
      }

      // Load and add layers
      await loadAndAddLayers();

      window.dispatchEvent(new CustomEvent('innomapcad:ready'));

    } catch (e) {
      console.error('[InnoMapCAD] Initialization failed:', e.message);
      window.dispatchEvent(new CustomEvent('innomapcad:error', { detail: e.message }));
    }
  }

  async function loadAndAddLayers() {
    const bridge = window.__innomapcad_bridge;
    const { GeoJsonLayerClass } = window.__innomapcad;

    if (!GeoJsonLayerClass) {
      console.warn('[InnoMapCAD] GeoJsonLayer class not found, skipping layer creation');
      return;
    }

    // Load cadastral data
    try {
      const resp = await fetch(`${BACKEND_URL}/api/v1/layers/cadastral`);
      if (resp.ok) {
        const data = await resp.json();
        const layer = window.__innomapcad_createCadastralLayer(GeoJsonLayerClass, data);
        bridge.addLayer(layer);
        console.log('[InnoMapCAD] Cadastral layer added');
      }
    } catch (e) {
      console.warn('[InnoMapCAD] Failed to load cadastral data:', e);
    }

    // Load protection zones
    try {
      const resp = await fetch(`${BACKEND_URL}/api/v1/layers/protection_zones`);
      if (resp.ok) {
        const data = await resp.json();
        const layer = window.__innomapcad_createZonesLayer(GeoJsonLayerClass, data);
        bridge.addLayer(layer);
        console.log('[InnoMapCAD] Protection zones layer added');
      }
    } catch (e) {
      console.warn('[InnoMapCAD] Failed to load zones data:', e);
    }
  }
```

- [ ] **Step 6: Update manifest.json to include new scripts**

Add layer scripts to `web_accessible_resources` and update content_scripts to inject them:

```json
{
  "content_scripts": [{
    "matches": ["*://4dinno.ru/map/*"],
    "js": ["content.js"],
    "css": ["ui/panel.css"],
    "run_at": "document_idle"
  }],
  "web_accessible_resources": [{
    "resources": [
      "injected.js",
      "layers/deck-bridge.js",
      "layers/cadastral-layer.js",
      "layers/zones-layer.js",
      "data/*",
      "lib/*"
    ],
    "matches": ["*://4dinno.ru/*"]
  }]
}
```

Update `content.js` to inject all page-context scripts:

```javascript
  function injectPageScript() {
    const scripts = [
      'layers/deck-bridge.js',
      'layers/cadastral-layer.js',
      'layers/zones-layer.js',
      'injected.js',  // Must be last — it calls init()
    ];
    // Chain loading sequentially to guarantee order
    function loadNext(index) {
      if (index >= scripts.length) return;
      const src = scripts[index];
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      if (src === 'injected.js') {
        script.dataset.backendUrl = BACKEND_URL;
        script.dataset.extensionId = chrome.runtime.id;
      }
      script.onload = () => {
        script.remove();
        loadNext(index + 1);
      };
      (document.head || document.documentElement).appendChild(script);
    }
    loadNext(0);
  }
```

- [ ] **Step 7: Test manually**

1. Start backend: `docker compose up`
2. Reload extension in Chrome
3. Navigate to 4dinno.ru/map/territory
4. Expected: cadastral parcels (blue) and protection zones (red) visible on map
5. Console shows: `[InnoMapCAD] Cadastral layer added` and `[InnoMapCAD] Protection zones layer added`

- [ ] **Step 8: Commit**

```bash
git add extension/
git commit -m "feat: deck.gl layer injection for cadastral parcels and protection zones"
```

---

## Task 7: Chrome Extension — UI Panel

**Goal:** Floating panel with layer toggles, preset palette, and validation status.

**Files:**
- Create: `extension/ui/panel.js`
- Create: `extension/ui/panel.css`
- Modify: `extension/content.js` (inject panel)

- [ ] **Step 1: Create panel.css**

```css
/* extension/ui/panel.css */
#innomapcad-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 300px;
  max-height: calc(100vh - 100px);
  background: #1f1f1f;
  color: #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  overflow-y: auto;
  user-select: none;
}

#innomapcad-panel .panel-header {
  padding: 12px 16px;
  background: #2a2a2a;
  border-radius: 12px 12px 0 0;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
}

#innomapcad-panel .panel-section {
  padding: 12px 16px;
  border-top: 1px solid #333;
}

#innomapcad-panel .section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

/* Layer toggles */
#innomapcad-panel .layer-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

#innomapcad-panel .layer-toggle input[type="checkbox"] {
  accent-color: #4A90D9;
}

/* Preset cards */
#innomapcad-panel .preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

#innomapcad-panel .preset-card {
  padding: 8px;
  background: #2a2a2a;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s;
}

#innomapcad-panel .preset-card:hover {
  border-color: #555;
}

#innomapcad-panel .preset-card.active {
  border-color: #4A90D9;
}

#innomapcad-panel .preset-color {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  margin: 0 auto 4px;
}

#innomapcad-panel .preset-name {
  font-size: 11px;
}

#innomapcad-panel .preset-size {
  font-size: 10px;
  color: #888;
}

/* Validation status */
#innomapcad-panel .validation-status {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
}

#innomapcad-panel .validation-status.valid {
  background: rgba(40, 167, 69, 0.2);
  color: #5cb85c;
}

#innomapcad-panel .validation-status.invalid {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}

#innomapcad-panel .validation-status.idle {
  background: rgba(108, 117, 125, 0.2);
  color: #999;
}

#innomapcad-panel .conflict-item {
  padding: 4px 0;
  font-size: 11px;
  color: #dc3545;
}

/* Action buttons */
#innomapcad-panel .btn {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  margin-top: 6px;
}

#innomapcad-panel .btn-primary {
  background: #4A90D9;
  color: white;
}

#innomapcad-panel .btn-primary:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

#innomapcad-panel .btn-danger {
  background: #dc3545;
  color: white;
}
```

- [ ] **Step 2: Create panel.js**

```javascript
// extension/ui/panel.js
// Builds and manages the floating UI panel. Runs in content script context.
(function() {
  'use strict';

  const PRESETS = [
    {slug: "residential", name: "Жилое здание", width_m: 30, length_m: 15, floors: 5, height_m: 15, setback_m: 10, color: "#4A90D9"},
    {slug: "office", name: "Офисное здание", width_m: 40, length_m: 20, floors: 3, height_m: 12, setback_m: 8, color: "#5BC0DE"},
    {slug: "transformer", name: "ТП", width_m: 6, length_m: 4, floors: 1, height_m: 3, setback_m: 15, color: "#F0AD4E"},
    {slug: "parking", name: "Парковка", width_m: 25, length_m: 15, floors: 1, height_m: 0, setback_m: 3, color: "#999999"},
    {slug: "warehouse", name: "Склад", width_m: 30, length_m: 20, floors: 1, height_m: 6, setback_m: 5, color: "#8B6914"},
  ];

  let state = {
    selectedPreset: null,
    layersVisible: { cadastral: true, zones: true },
    validation: { status: 'idle', conflicts: [] },
    placedObject: null,
  };

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'innomapcad-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span>InnoMapCAD</span>
        <span style="font-size:10px;color:#666">v0.1</span>
      </div>

      <div class="panel-section">
        <div class="section-title">Слои</div>
        <label class="layer-toggle">
          <input type="checkbox" id="imc-layer-cadastral" checked>
          <span style="color:#4A90D9">■</span> Кадастровые участки
        </label>
        <label class="layer-toggle">
          <input type="checkbox" id="imc-layer-zones" checked>
          <span style="color:#dc3545">■</span> Охранные зоны
        </label>
      </div>

      <div class="panel-section">
        <div class="section-title">Объекты</div>
        <div class="preset-grid" id="imc-presets"></div>
      </div>

      <div class="panel-section">
        <div class="section-title">Размещение</div>
        <div id="imc-placement-info" class="validation-status idle">
          Выберите тип объекта и кликните на карту
        </div>
        <div id="imc-conflicts"></div>
        <button class="btn btn-primary" id="imc-validate-btn" disabled>
          Проверить на сервере
        </button>
        <button class="btn btn-danger" id="imc-clear-btn" style="display:none">
          Убрать объект
        </button>
      </div>
    `;

    // Populate presets
    const grid = panel.querySelector('#imc-presets');
    PRESETS.forEach(p => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.dataset.slug = p.slug;
      card.innerHTML = `
        <div class="preset-color" style="background:${p.color}"></div>
        <div class="preset-name">${p.name}</div>
        <div class="preset-size">${p.width_m}×${p.length_m}м</div>
      `;
      card.addEventListener('click', () => selectPreset(p));
      grid.appendChild(card);
    });

    // Layer toggles
    panel.querySelector('#imc-layer-cadastral').addEventListener('change', (e) => {
      state.layersVisible.cadastral = e.target.checked;
      window.postMessage({ type: 'innomapcad:toggle-layer', layer: 'cadastral', visible: e.target.checked }, '*');
    });
    panel.querySelector('#imc-layer-zones').addEventListener('change', (e) => {
      state.layersVisible.zones = e.target.checked;
      window.postMessage({ type: 'innomapcad:toggle-layer', layer: 'zones', visible: e.target.checked }, '*');
    });

    // Validate button
    panel.querySelector('#imc-validate-btn').addEventListener('click', () => {
      window.postMessage({ type: 'innomapcad:validate-server' }, '*');
    });

    // Clear button
    panel.querySelector('#imc-clear-btn').addEventListener('click', () => {
      window.postMessage({ type: 'innomapcad:clear-placement' }, '*');
      updateValidation('idle', []);
      state.placedObject = null;
      panel.querySelector('#imc-clear-btn').style.display = 'none';
      panel.querySelector('#imc-validate-btn').disabled = true;
    });

    document.body.appendChild(panel);
    return panel;
  }

  function selectPreset(preset) {
    state.selectedPreset = preset;
    // Update UI
    document.querySelectorAll('.preset-card').forEach(card => {
      card.classList.toggle('active', card.dataset.slug === preset.slug);
    });
    // Notify page script
    window.postMessage({ type: 'innomapcad:select-preset', preset }, '*');
    updatePlacementInfo(`Кликните на карту для размещения: ${preset.name}`);
  }

  function updatePlacementInfo(text) {
    const el = document.getElementById('imc-placement-info');
    if (el) el.textContent = text;
  }

  function updateValidation(status, conflicts) {
    state.validation = { status, conflicts };
    const el = document.getElementById('imc-placement-info');
    const conflictsEl = document.getElementById('imc-conflicts');
    if (!el || !conflictsEl) return;

    el.className = 'validation-status ' + status;
    if (status === 'valid') {
      el.textContent = 'Размещение допустимо';
    } else if (status === 'invalid') {
      el.textContent = `Обнаружено конфликтов: ${conflicts.length}`;
    } else {
      el.textContent = 'Выберите тип объекта и кликните на карту';
    }

    conflictsEl.innerHTML = conflicts.map(c =>
      `<div class="conflict-item">⚠ ${c.description}</div>`
    ).join('');
  }

  // Listen for messages from page script
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'innomapcad:placement-result') {
      const { valid, conflicts } = event.data;
      updateValidation(valid ? 'valid' : 'invalid', conflicts || []);
      document.getElementById('imc-validate-btn').disabled = false;
      document.getElementById('imc-clear-btn').style.display = 'block';
    }
    if (event.data?.type === 'innomapcad:server-validation-result') {
      const { valid, conflicts } = event.data;
      updateValidation(valid ? 'valid' : 'invalid', conflicts || []);
    }
  });

  // Export for content.js
  window.__innomapcad_createPanel = createPanel;
})();
```

- [ ] **Step 3: Update content.js to inject panel**

Update `content.js` init function:

```javascript
  async function init() {
    console.log('[InnoMapCAD] Waiting for map...');
    await waitForMap();
    console.log('[InnoMapCAD] Map found, injecting...');

    // Inject UI panel (runs in content script context)
    injectPanelScript();

    // Inject page-context scripts (runs in page context)
    injectPageScript();
  }

  // panel.js is loaded via content_scripts in manifest.json
  // Just call createPanel after map is ready
  if (window.__innomapcad_createPanel) {
    window.__innomapcad_createPanel();
  }
```

Update `manifest.json` to include `panel.js` in `content_scripts` (not `web_accessible_resources`):

```json
  "content_scripts": [{
    "matches": ["*://4dinno.ru/map/*"],
    "js": ["ui/panel.js", "content.js"],
    "css": ["ui/panel.css"],
    "run_at": "document_idle"
  }],
```

- [ ] **Step 4: Test manually**

1. Reload extension
2. Navigate to 4dinno.ru/map/territory
3. Expected: dark floating panel in top-right with layer toggles, preset cards, placement section

- [ ] **Step 5: Commit**

```bash
git add extension/ui/ extension/content.js extension/manifest.json
git commit -m "feat: floating UI panel with layer toggles, preset palette, validation status"
```

---

## Task 8: Chrome Extension — Building Placement + Client Validation

**Goal:** Click on map to place a building from selected preset. Turf.js validates against zones in real-time.

**Files:**
- Create: `extension/layers/placement-layer.js`
- Create: `extension/validation/client-validator.js`
- Create: `extension/validation/server-validator.js`
- Modify: `extension/injected.js` (handle placement clicks, validation)
- Add: `extension/lib/turf.min.js` (vendored)

- [ ] **Step 1: Vendor Turf.js**

```bash
cd extension/lib
curl -o turf.min.js https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js
```

Add `lib/turf.min.js` to injected scripts in `content.js` (before `injected.js`).

- [ ] **Step 2: Create placement-layer.js**

```javascript
// extension/layers/placement-layer.js
// Creates and updates the placed building + setback buffer layers.
(function() {
  'use strict';

  /**
   * Create a rectangular polygon at given center point.
   * @param {number} lng - Center longitude
   * @param {number} lat - Center latitude
   * @param {number} widthM - Width in meters
   * @param {number} lengthM - Length in meters
   * @returns {Object} GeoJSON Polygon
   */
  function createBuildingPolygon(lng, lat, widthM, lengthM) {
    // Convert meters to approximate degrees at this latitude
    const latDeg = lengthM / 111000;
    const lngDeg = widthM / (111000 * Math.cos(lat * Math.PI / 180));

    const halfLng = lngDeg / 2;
    const halfLat = latDeg / 2;

    return {
      type: 'Polygon',
      coordinates: [[
        [lng - halfLng, lat - halfLat],
        [lng + halfLng, lat - halfLat],
        [lng + halfLng, lat + halfLat],
        [lng - halfLng, lat + halfLat],
        [lng - halfLng, lat - halfLat],
      ]]
    };
  }

  /**
   * Create placement layer (building footprint).
   */
  function createPlacementLayer(SolidPolygonLayerClass, geometry, color, isValid) {
    const rgba = hexToRgba(color, isValid ? 150 : 100);
    const borderColor = isValid ? [40, 167, 69, 200] : [220, 53, 69, 200];

    return new SolidPolygonLayerClass({
      id: 'innomapcad-placement',
      data: [{ polygon: geometry.coordinates }],
      extruded: false,
      filled: true,
      getPolygon: d => d.polygon,
      getFillColor: rgba,
      getLineColor: borderColor,
      getLineWidth: 3,
      lineWidthMinPixels: 2,
      pickable: false,
    });
  }

  /**
   * Create setback buffer layer.
   */
  function createBufferLayer(GeoJsonLayerClass, geometry, setbackM) {
    if (!window.turf || setbackM <= 0) return null;
    const feature = { type: 'Feature', geometry, properties: {} };
    const buffered = turf.buffer(feature, setbackM / 1000, { units: 'kilometers' });

    return new GeoJsonLayerClass({
      id: 'innomapcad-buffer',
      data: buffered,
      pickable: false,
      stroked: true,
      filled: false,
      // Note: dashed lines would require PathStyleExtension (not available).
      // Using solid orange line instead.
      getLineColor: [255, 165, 0, 150],
      getLineWidth: 2,
      lineWidthMinPixels: 1,
    });
  }

  function hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return [128, 128, 128, alpha];
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
      alpha,
    ];
  }

  window.__innomapcad_placement = {
    createBuildingPolygon,
    createPlacementLayer,
    createBufferLayer,
  };
})();
```

- [ ] **Step 3: Create client-validator.js**

```javascript
// extension/validation/client-validator.js
// Turf.js-based client-side validation for instant visual feedback.
(function() {
  'use strict';

  /**
   * Validate placement against loaded zone data.
   * @param {Object} buildingGeometry - GeoJSON Polygon of placed building
   * @param {Object} zonesGeoJSON - FeatureCollection of protection zones
   * @returns {{ valid: boolean, conflicts: Array }}
   */
  function validateClient(buildingGeometry, zonesGeoJSON) {
    if (!window.turf) {
      console.warn('[InnoMapCAD] Turf.js not loaded, skipping client validation');
      return { valid: true, conflicts: [] };
    }

    const conflicts = [];
    const building = turf.feature(buildingGeometry);

    if (!zonesGeoJSON?.features) {
      return { valid: true, conflicts: [] };
    }

    for (const zone of zonesGeoJSON.features) {
      try {
        const intersection = turf.intersect(
          turf.featureCollection([building, turf.feature(zone.geometry)])
        );
        if (intersection) {
          conflicts.push({
            layer: 'protection_zones',
            type: 'intersection',
            description: `Пересечение с: ${zone.properties?.name || 'охранная зона'}`,
          });
        }
      } catch (e) {
        // Turf can throw on invalid geometries, skip
      }
    }

    return { valid: conflicts.length === 0, conflicts };
  }

  window.__innomapcad_validateClient = validateClient;
})();
```

- [ ] **Step 4: Create server-validator.js**

```javascript
// extension/validation/server-validator.js
// Calls backend POST /api/v1/validate for authoritative validation.
(function() {
  'use strict';

  async function validateServer(backendUrl, geometry, presetSlug) {
    try {
      const resp = await fetch(`${backendUrl}/api/v1/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry, preset_slug: presetSlug }),
      });
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      return await resp.json();
    } catch (e) {
      console.error('[InnoMapCAD] Server validation failed:', e);
      return { valid: false, conflicts: [{ layer: 'server', type: 'error', description: 'Сервер недоступен' }] };
    }
  }

  window.__innomapcad_validateServer = validateServer;
})();
```

- [ ] **Step 5: Update injected.js — handle placement and validation**

Add to `injected.js`, after `loadAndAddLayers()` call:

```javascript
  // --- Placement handling ---
  let currentPreset = null;
  let currentPlacement = null; // GeoJSON geometry
  let zonesData = null;

  // Listen for messages from UI panel
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'innomapcad:select-preset') {
      currentPreset = event.data.preset;
      console.log('[InnoMapCAD] Preset selected:', currentPreset.slug);
    }

    if (event.data?.type === 'innomapcad:validate-server') {
      if (currentPlacement && currentPreset) {
        window.__innomapcad_validateServer(
          BACKEND_URL, currentPlacement, currentPreset.slug
        ).then(result => {
          window.postMessage({ type: 'innomapcad:server-validation-result', ...result }, '*');
        });
      }
    }

    if (event.data?.type === 'innomapcad:clear-placement') {
      const bridge = window.__innomapcad_bridge;
      bridge.removeLayer('innomapcad-placement');
      bridge.removeLayer('innomapcad-buffer');
      currentPlacement = null;
    }

    if (event.data?.type === 'innomapcad:toggle-layer') {
      const bridge = window.__innomapcad_bridge;
      const layerId = event.data.layer === 'cadastral'
        ? 'innomapcad-cadastral' : 'innomapcad-zones';
      if (!event.data.visible) {
        // Cache layer before removing
        const layer = bridge.customLayers.find(l => l.props.id === layerId);
        if (layer) {
          window.__innomapcad_cachedLayers = window.__innomapcad_cachedLayers || {};
          window.__innomapcad_cachedLayers[layerId] = layer;
        }
        bridge.removeLayer(layerId);
      } else {
        // Re-add cached layer
        const cached = window.__innomapcad_cachedLayers?.[layerId];
        if (cached) bridge.addLayer(cached);
      }
    }
  });

  // Store zones data for client validation
  async function cacheZonesData() {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/v1/layers/protection_zones`);
      if (resp.ok) zonesData = await resp.json();
    } catch (e) { /* ignore */ }
  }

  // Map click handler for placement
  function setupPlacementHandler() {
    const deck = window.__innomapcad.deck;
    const bridge = window.__innomapcad_bridge;

    // We need to listen for clicks on the deck.gl canvas
    const canvas = document.querySelector('#deckgl-overlay');
    if (!canvas) return;

    canvas.addEventListener('click', (event) => {
      if (!currentPreset) return;

      // Get geographic coordinates from pixel coordinates
      const [lng, lat] = deck.viewManager?.getViewports()?.[0]?.unproject([event.offsetX, event.offsetY]) || [];
      if (!lng || !lat) return;

      // Create building polygon
      const placement = window.__innomapcad_placement;
      const geometry = placement.createBuildingPolygon(lng, lat, currentPreset.width_m, currentPreset.length_m);
      currentPlacement = geometry;

      // Client-side validation
      const clientResult = window.__innomapcad_validateClient(geometry, zonesData);

      // Update placement layer
      const { SolidPolygonLayer, GeoJsonLayerClass } = window.__innomapcad;

      if (SolidPolygonLayer) {
        const placementLayer = placement.createPlacementLayer(
          SolidPolygonLayer, geometry, currentPreset.color, clientResult.valid
        );
        bridge.removeLayer('innomapcad-placement');
        bridge.addLayer(placementLayer);
      }

      if (GeoJsonLayerClass) {
        const bufferLayer = placement.createBufferLayer(
          GeoJsonLayerClass, geometry, currentPreset.setback_m
        );
        if (bufferLayer) {
          bridge.removeLayer('innomapcad-buffer');
          bridge.addLayer(bufferLayer);
        }
      }

      // Send result to UI panel
      window.postMessage({
        type: 'innomapcad:placement-result',
        valid: clientResult.valid,
        conflicts: clientResult.conflicts,
      }, '*');

      console.log(`[InnoMapCAD] Placed ${currentPreset.slug} at [${lng.toFixed(5)}, ${lat.toFixed(5)}], valid: ${clientResult.valid}`);
    });
  }

  // Call after layers are loaded
  cacheZonesData();
  setupPlacementHandler();
```

> **Note:** Drag-to-move for placed objects is descoped for MVP. Users click to re-place objects at a new location. This matches the simplified spec scope.

- [ ] **Step 6: Update content.js to inject all new scripts**

Replace the `injectPageScript` function with the full sequential loader:

```javascript
  function injectPageScript() {
    const scripts = [
      'lib/turf.min.js',
      'layers/deck-bridge.js',
      'layers/cadastral-layer.js',
      'layers/zones-layer.js',
      'layers/placement-layer.js',
      'validation/client-validator.js',
      'validation/server-validator.js',
      'injected.js',
    ];
    // Chain loading sequentially to guarantee order
    function loadNext(index) {
      if (index >= scripts.length) return;
      const src = scripts[index];
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      if (src === 'injected.js') {
        script.dataset.backendUrl = BACKEND_URL;
        script.dataset.extensionId = chrome.runtime.id;
      }
      script.onload = () => {
        script.remove();
        loadNext(index + 1);
      };
      (document.head || document.documentElement).appendChild(script);
    }
    loadNext(0);
  }
```

Update `manifest.json` `web_accessible_resources` to include new paths.

- [ ] **Step 7: Test manually — full flow**

1. Backend running: `docker compose up`
2. Reload extension, go to 4dinno.ru/map/territory
3. Select "Жилое здание" from panel
4. Click on map — building appears (green or red depending on zones)
5. Click "Проверить" — server validation runs
6. Click "Убрать объект" — building removed
7. Place building inside a protection zone — should show red + conflicts

> **Optional:** If time permits, add Node.js unit tests for `createBuildingPolygon` and `validateClient` using a simple test runner (e.g., `node --test`).

- [ ] **Step 8: Commit**

```bash
git add extension/
git commit -m "feat: interactive building placement with Turf.js client validation and server validation"
```

---

## Task 9: Integration Testing + Polish

**Goal:** End-to-end test, fix issues, ensure demo flow works smoothly.

**Files:**
- Modify: various files as needed for bug fixes
- Create: `backend/tests/test_integration.py`

- [ ] **Step 1: Write integration test for full validation flow**

```python
# backend/tests/test_integration.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_full_flow_presets_then_validate():
    """Simulate: get presets → pick one → validate placement."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get presets
        resp = await client.get("/api/v1/presets")
        assert resp.status_code == 200
        presets = resp.json()
        residential = next(p for p in presets if p["slug"] == "residential")

        # 2. Get layers
        resp = await client.get("/api/v1/layers/cadastral")
        assert resp.status_code == 200

        resp = await client.get("/api/v1/layers/protection_zones")
        assert resp.status_code == 200

        # 3. Validate — safe location
        resp = await client.post("/api/v1/validate", json={
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[48.76, 55.76], [48.761, 55.76],
                                 [48.761, 55.761], [48.76, 55.761],
                                 [48.76, 55.76]]]
            },
            "preset_slug": residential["slug"]
        })
        assert resp.status_code == 200
        assert resp.json()["valid"] is True
```

- [ ] **Step 2: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: All PASS.

- [ ] **Step 3: Test full demo flow manually in browser**

Checklist:
1. `docker compose up` — backend starts, data loaded
2. Chrome Extension loaded, navigate to 4dinno.ru/map/territory
3. Panel appears in top-right
4. Cadastral parcels visible (blue polygons)
5. Protection zones visible (red polygons)
6. Select "ТП" preset → click on map → building appears
7. Place inside zone → red, conflicts shown
8. Place outside zone → green, "Размещение допустимо"
9. Click "Проверить" → server confirms
10. Click "Убрать объект" → cleared

- [ ] **Step 4: Fix any issues found during testing**

Address bugs found in step 3.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: integration tests and demo flow polish"
```

---

## Summary

| Task | Component | Estimated Time |
|------|-----------|---------------|
| 0 | Data preparation (NSPD fetch/mock) | 30-60 min |
| 1 | Backend skeleton + health | 15 min |
| 2 | Presets endpoint | 10 min |
| 3 | Layers endpoint | 15 min |
| 4 | Validation endpoint | 20 min |
| 5 | Extension skeleton + deck.gl bridge | 20 min |
| 6 | Layer injection (cadastral + zones) | 20 min |
| 7 | UI panel | 20 min |
| 8 | Placement + client/server validation | 30 min |
| 9 | Integration testing + polish | 30 min |
| **Total** | | **~3.5 hours** |
