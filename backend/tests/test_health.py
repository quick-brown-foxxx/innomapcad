"""Tests for GET /health endpoint."""

from __future__ import annotations

import msgspec
from fastapi.testclient import TestClient

from src.models import HealthResponse


def _parse_health(client: TestClient) -> HealthResponse:
    """Request /health and decode the response into a typed struct."""
    response = client.get("/health")
    assert response.status_code == 200
    return msgspec.json.decode(response.content, type=HealthResponse)


def test_health_returns_200_with_status_ok(client: TestClient) -> None:
    """Health endpoint returns 200 with status 'ok'."""
    data = _parse_health(client)
    assert data.status == "ok"


def test_health_response_has_layers_loaded_2(client: TestClient) -> None:
    """Health endpoint reports exactly 2 layers loaded."""
    data = _parse_health(client)
    assert data.layers_loaded == 2


def test_health_response_shape(client: TestClient) -> None:
    """Health response contains exactly the expected fields."""
    data = _parse_health(client)
    fields = {field for field in data.__struct_fields__}
    assert fields == {"status", "layers_loaded"}
