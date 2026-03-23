"""Tests for POST /api/v1/validate endpoint."""

from __future__ import annotations

import msgspec
from fastapi.testclient import TestClient

from src.models import ValidateResponse


def _make_polygon(lon_min: float, lat_min: float, lon_max: float, lat_max: float) -> dict[str, object]:
    """Create a small GeoJSON Polygon from bounding box coords."""
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [lon_min, lat_min],
                [lon_max, lat_min],
                [lon_max, lat_max],
                [lon_min, lat_max],
                [lon_min, lat_min],
            ]
        ],
    }


def _post_validate(client: TestClient, geometry: dict[str, object], preset_slug: str) -> ValidateResponse:
    """Post to /api/v1/validate and decode as ValidateResponse."""
    response = client.post("/api/v1/validate", json={"geometry": geometry, "preset_slug": preset_slug})
    assert response.status_code == 200
    return msgspec.json.decode(response.content, type=ValidateResponse)


def test_valid_placement_no_conflicts(client: TestClient) -> None:
    """Building fully inside parcel 003 (NE corner), no protection zone overlap."""
    # Parcel 003 spans lon 48.7458..48.7490, lat 55.7520..55.7534
    # No protection zones in this area
    geometry = _make_polygon(48.747, 55.7525, 48.748, 55.7530)
    data = _post_validate(client, geometry, "residential")
    assert data.valid is True
    assert len(data.conflicts) == 0


def test_zone_intersection_gas_pipeline(client: TestClient) -> None:
    """Building overlapping the gas pipeline protection zone returns conflicts."""
    # Gas pipeline runs through lon ~48.739..48.741, lat ~55.750..55.754
    geometry = _make_polygon(48.7395, 55.7520, 48.7405, 55.7525)
    data = _post_validate(client, geometry, "residential")
    assert data.valid is False
    assert len(data.conflicts) >= 1
    first = data.conflicts[0]
    assert first.layer == "protection_zones"
    assert first.type == "zone_intersection"
    assert first.overlap_area_m2 is not None
    assert first.overlap_area_m2 > 0


def test_setback_violation(client: TestClient) -> None:
    """Building near gas pipeline — does not directly intersect but within setback distance.

    The residential preset has setback_m=5. We place the building just outside
    the gas pipeline zone boundary but within 5m of it.
    The gas pipeline eastern edge at lat ~55.752 is approximately at lon 48.74116.
    5m in longitude at this latitude is ~0.00008 degrees.
    A building at lon 48.74118..48.74122 is ~1-4m east of the zone edge — within 5m setback.
    Note: this building falls in a gap between parcels, so it also gets
    an "outside_parcel" conflict, which is expected.
    """
    geometry = _make_polygon(48.74118, 55.7520, 48.74122, 55.7522)
    data = _post_validate(client, geometry, "residential")
    assert data.valid is False
    conflict_types = [c.type for c in data.conflicts]
    assert "setback_violation" in conflict_types


def test_bad_geometry_point_returns_422(client: TestClient) -> None:
    """Point geometry instead of Polygon returns 422."""
    geometry: dict[str, object] = {"type": "Point", "coordinates": [48.74, 55.75]}
    response = client.post("/api/v1/validate", json={"geometry": geometry, "preset_slug": "residential"})
    assert response.status_code == 422


def test_bad_geometry_empty_coords_returns_422(client: TestClient) -> None:
    """Polygon with empty coordinates returns 422."""
    geometry: dict[str, object] = {"type": "Polygon", "coordinates": []}
    response = client.post("/api/v1/validate", json={"geometry": geometry, "preset_slug": "residential"})
    assert response.status_code == 422


def test_unknown_preset_slug_returns_422(client: TestClient) -> None:
    """Non-existent preset_slug returns 422."""
    geometry = _make_polygon(48.747, 55.7525, 48.748, 55.7530)
    response = client.post("/api/v1/validate", json={"geometry": geometry, "preset_slug": "nonexistent"})
    assert response.status_code == 422
