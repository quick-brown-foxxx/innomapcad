"""Tests for GET /api/v1/presets endpoint."""

from __future__ import annotations

import msgspec
from fastapi.testclient import TestClient

from src.models import Preset

_REQUIRED_FIELDS: set[str] = {"slug", "name", "width_m", "length_m", "floors", "height_m", "setback_m", "color"}


def _fetch_presets(client: TestClient) -> list[Preset]:
    """Request /api/v1/presets and decode into typed structs."""
    response = client.get("/api/v1/presets")
    assert response.status_code == 200
    return msgspec.json.decode(response.content, type=list[Preset])


def test_presets_returns_five(client: TestClient) -> None:
    """Endpoint returns exactly 5 building presets."""
    presets = _fetch_presets(client)
    assert len(presets) == 5


def test_presets_have_required_fields(client: TestClient) -> None:
    """Every preset contains all required fields."""
    presets = _fetch_presets(client)
    for preset in presets:
        assert set(preset.__struct_fields__) >= _REQUIRED_FIELDS


def test_presets_slugs_are_unique(client: TestClient) -> None:
    """Each preset has a unique slug identifier."""
    presets = _fetch_presets(client)
    slugs = [p.slug for p in presets]
    assert len(slugs) == len(set(slugs))
