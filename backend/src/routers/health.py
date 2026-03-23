"""Health check router."""

from __future__ import annotations

from fastapi import APIRouter

from src.models import HealthResponse
from src.services.data_store import data_store

router: APIRouter = APIRouter()


@router.get("/health")
async def health() -> dict[str, str | int]:
    """Health check endpoint."""
    response = HealthResponse(status="ok", layers_loaded=data_store.layers_loaded)
    return response.to_dict()
