from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client() -> Generator[TestClient]:
    """FastAPI TestClient — triggers lifespan events for data loading."""
    with TestClient(app) as test_client:
        yield test_client
