"""GeoJSON layers router."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.services.data_store import data_store

router: APIRouter = APIRouter(prefix="/api/v1")


@router.get("/layers/{slug}")
async def get_layer(slug: str) -> dict[str, object]:
    """Return a GeoJSON FeatureCollection for the given layer slug."""
    layer = data_store.get_layer(slug)
    if layer is None:
        raise HTTPException(status_code=404, detail=f"Layer '{slug}' not found")
    return {
        "type": layer.type,
        "features": [
            {
                "type": f.type,
                "geometry": f.geometry,
                "properties": f.properties,
            }
            for f in layer.features
        ],
    }
