---
name: testing-python
description: "Python testing with pytest for FastAPI + Shapely GIS backend: fixtures, validation, geometry testing. Use when writing tests or setting up test infrastructure."
---

# Testing Python — InnoMapCAD Backend

Tests prove features work. Coverage is secondary. Real geometry beats mocked geometry. Real HTTP beats patched handlers.

---

## Philosophy

- **Trustworthiness > coverage.** A test that mocks away Shapely proves nothing about geometry.
- **Real over mocked.** Real FastAPI TestClient, real Shapely operations, real GeoJSON files.
- **Pareto principle.** Write the fewest tests that cover 80% of what matters.
- **Each endpoint: minimum 2 tests** — happy path + edge case.
- **Never mock Shapely** — test with real geometry operations.
- **Never mock GeoJSON** — use real files from `backend/data/` or realistic coordinates.

---

## Backend as E2E Test Server

The FastAPI backend serves double duty:

1. **Production API** for the Chrome Extension
2. **Test fixture server** for Playwright e2e tests

When Playwright e2e tests run, they start the backend via `webServer` config in `playwright.config.ts`. The backend serves real GeoJSON data from `backend/data/`. This means:

- **Backend tests** (pytest + TestClient) verify API contracts independently
- **E2e tests** (Playwright) start the real backend and test the full stack
- **No separate mock servers needed** — the real backend IS the test fixture

The two test layers complement each other:

| Layer | Tool | What it tests |
|-------|------|---------------|
| API contracts | pytest + TestClient | Endpoints, validation, geometry logic |
| Full stack | Playwright | Extension UI + backend integration |

---

## Test Planning

When writing new tests, plan before coding:

1. List all potential test cases for the feature
2. Categorize each as **critical**, **medium**, or **small** importance
3. Discard small-importance cases — not worth the maintenance cost
4. Write remaining cases **in plain text** to `docs/plans/test-cases-<feature>.md`
5. Only then write test code

---

## Test Structure

```
backend/
├── tests/
│   ├── conftest.py              # Shared fixtures (TestClient, geometry helpers)
│   ├── test_health.py           # GET /health
│   ├── test_presets.py          # GET /api/v1/presets
│   ├── test_layers.py           # GET /api/v1/layers/{slug}
│   ├── test_validate.py         # POST /api/v1/validate (main business logic)
│   └── fixtures/
│       ├── building_in_zone.geojson
│       └── building_clear.geojson
```

---

## Fixtures

### conftest.py

```python
# conftest.py
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """FastAPI TestClient — real HTTP, real Shapely, no mocks."""
    return TestClient(app)


@pytest.fixture
def building_in_zone() -> dict:
    """Building polygon that intersects a protection zone."""
    return {
        "type": "Polygon",
        "coordinates": [[
            [48.7440, 55.7515],
            [48.7443, 55.7515],
            [48.7443, 55.7517],
            [48.7440, 55.7517],
            [48.7440, 55.7515],
        ]]
    }


@pytest.fixture
def building_outside_zones() -> dict:
    """Building polygon in a clear area."""
    return {
        "type": "Polygon",
        "coordinates": [[
            [48.7500, 55.7550],
            [48.7503, 55.7550],
            [48.7503, 55.7552],
            [48.7500, 55.7552],
            [48.7500, 55.7550],
        ]]
    }
```

Key rules for fixtures:

- Use **real coordinates near Innopolis** (lon ~48.74, lat ~55.75)
- GeoJSON fixtures use real polygons, not abstract shapes
- The `client` fixture tests the full FastAPI stack (CORS, lifespan, routing)
- Shapely buffers use **pyproj UTM (EPSG:32639)** for metric accuracy

---

## Test Patterns

### test_health.py — Health Check

```python
def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
```

### test_presets.py — Building Presets

```python
def test_presets_returns_five(client):
    response = client.get("/api/v1/presets")
    assert response.status_code == 200
    presets = response.json()
    assert len(presets) == 5

def test_presets_have_required_fields(client):
    response = client.get("/api/v1/presets")
    presets = response.json()
    for preset in presets:
        assert "name" in preset
        assert "geometry" in preset
```

### test_layers.py — GeoJSON Layers

```python
def test_layers_returns_feature_collection(client):
    response = client.get("/api/v1/layers/cadastral")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0

def test_layers_unknown_slug_404(client):
    response = client.get("/api/v1/layers/nonexistent")
    assert response.status_code == 404
```

### test_validate.py — Geometry Validation (Main Business Logic)

```python
def test_validate_building_in_zone_returns_conflicts(client, building_in_zone):
    """Building inside a protection zone must return conflicts."""
    response = client.post("/api/v1/validate", json={
        "geometry": building_in_zone,
        "preset": "residential",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert len(data["conflicts"]) > 0


def test_validate_building_outside_zones_returns_valid(client, building_outside_zones):
    """Building in a clear area must pass validation."""
    response = client.post("/api/v1/validate", json={
        "geometry": building_outside_zones,
        "preset": "residential",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert len(data["conflicts"]) == 0


def test_validate_setback_violation(client):
    """Building that clears zone boundary but violates setback buffer.

    The setback buffer is computed via pyproj UTM (EPSG:32639) for metric
    accuracy. A building just outside a zone polygon may still fail if it
    falls within the required setback distance.
    """
    # Polygon barely outside a protection zone — within setback buffer
    near_miss_building = {
        "type": "Polygon",
        "coordinates": [[
            [48.7441, 55.7518],
            [48.7443, 55.7518],
            [48.7443, 55.7519],
            [48.7441, 55.7519],
            [48.7441, 55.7518],
        ]]
    }
    response = client.post("/api/v1/validate", json={
        "geometry": near_miss_building,
        "preset": "residential",
    })
    assert response.status_code == 200
    data = response.json()
    # Should report setback violation even though not directly intersecting
    assert data["valid"] is False


def test_validate_invalid_geometry(client):
    """Malformed geometry must return a clear error."""
    response = client.post("/api/v1/validate", json={
        "geometry": {"type": "Polygon", "coordinates": []},
        "preset": "residential",
    })
    assert response.status_code == 422
```

---

## Key Rules

1. **Never mock Shapely** — test with real geometry operations
2. **Never mock GeoJSON** — use real files from `backend/data/` or realistic coordinates
3. **TestClient tests the full FastAPI stack** — CORS middleware, lifespan events, routing
4. **Each endpoint: minimum 2 tests** — happy path + edge case
5. **Shapely buffers use pyproj UTM (EPSG:32639)** for metric accuracy
6. **Real coordinates near Innopolis** — lon ~48.74, lat ~55.75
7. **No separate mock servers** — the real backend is the fixture for both pytest and Playwright

---

## Running Tests

```bash
cd backend && uv run pytest                         # All tests
cd backend && uv run pytest -v                      # Verbose
cd backend && uv run pytest tests/test_validate.py  # Specific file
cd backend && uv run pytest -k "test_validate"      # By name pattern
cd backend && uv run basedpyright                   # Type checking
cd backend && uv run ruff check                     # Linting
```

---

## Coverage Guidelines

Not targets to chase, but sanity checks:

| Area | Guideline |
|------|-----------|
| Validation logic (Shapely) | >80% |
| API endpoints | >70% |
| Data loading (GeoJSON) | >60% |
| Utilities | As needed |

If e2e Playwright tests cover the workflows end-to-end, lower pytest coverage is fine.

---

## Test Validation

After all tests are written and passing, validate test quality:

- **Meaningful coverage** — are tests verifying real geometry behavior, or just producing green checkmarks?
- **Correctness** — are assertions testing the right thing? No tautologies, no asserting mocks return what they were told to return.
- **No source code compromises** — was production code incorrectly adjusted just to make tests pass?
- **No shortcuts** — no `# type: ignore` to silence test failures, no overly broad exception catching.
