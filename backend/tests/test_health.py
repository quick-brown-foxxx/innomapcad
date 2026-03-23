"""Smoke test — verifies the backend app instance is importable."""

from __future__ import annotations

from fastapi.testclient import TestClient

from src.main import app


def test_app_creates() -> None:
    """The FastAPI app object should be importable and usable."""
    client = TestClient(app)
    assert client is not None
