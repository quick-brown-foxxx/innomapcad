"""Tests for GET /api/v1/layers/{slug} endpoint."""

from __future__ import annotations

import msgspec
from fastapi.testclient import TestClient

from src.services.data_store import FeatureCollection


def _fetch_layer(client: TestClient, slug: str) -> FeatureCollection:
    """Request a layer and decode into a typed FeatureCollection."""
    response = client.get(f"/api/v1/layers/{slug}")
    assert response.status_code == 200
    return msgspec.json.decode(response.content, type=FeatureCollection)


def test_cadastral_returns_feature_collection(client: TestClient) -> None:
    """Cadastral layer returns a valid GeoJSON FeatureCollection."""
    data = _fetch_layer(client, "cadastral")
    assert data.type == "FeatureCollection"
    assert len(data.features) > 0


def test_protection_zones_returns_feature_collection(client: TestClient) -> None:
    """Protection zones layer returns a valid GeoJSON FeatureCollection."""
    data = _fetch_layer(client, "protection_zones")
    assert data.type == "FeatureCollection"
    assert len(data.features) > 0


def test_nonexistent_layer_returns_404(client: TestClient) -> None:
    """Unknown layer slug returns 404."""
    response = client.get("/api/v1/layers/nonexistent")
    assert response.status_code == 404
