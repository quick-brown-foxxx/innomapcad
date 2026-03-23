"""Building geometry validation router."""

from __future__ import annotations

from typing import Final

import msgspec
from fastapi import APIRouter, HTTPException, Request

from src.models import Conflict, Preset, ValidateRequest, ValidateResponse
from src.services.data_store import data_store
from src.services.validator import (
    check_cadastral_within,
    check_setback_violations,
    check_zone_intersections,
    parse_polygon,
)

router: APIRouter = APIRouter(prefix="/api/v1")

_PRESETS: Final[dict[str, Preset]] = {
    "residential": Preset(
        slug="residential",
        name="Жилой дом",
        width_m=24,
        length_m=60,
        floors=9,
        height_m=27,
        setback_m=5,
        color="#4A90D9",
    ),
    "office": Preset(
        slug="office",
        name="Офисное здание",
        width_m=30,
        length_m=50,
        floors=5,
        height_m=17.5,
        setback_m=3,
        color="#50C878",
    ),
    "transformer": Preset(
        slug="transformer",
        name="ТП",
        width_m=6,
        length_m=4,
        floors=1,
        height_m=3,
        setback_m=10,
        color="#FFD700",
    ),
    "parking": Preset(
        slug="parking",
        name="Парковка",
        width_m=40,
        length_m=20,
        floors=1,
        height_m=3,
        setback_m=5,
        color="#808080",
    ),
    "warehouse": Preset(
        slug="warehouse",
        name="Склад",
        width_m=50,
        length_m=30,
        floors=1,
        height_m=8,
        setback_m=5,
        color="#CD853F",
    ),
}


@router.post("/validate")
async def validate_building(request: Request) -> dict[str, object]:
    """Validate building placement against protection zones and cadastral parcels."""
    raw_bytes = await request.body()
    try:
        body = msgspec.json.decode(raw_bytes, type=ValidateRequest)
    except msgspec.DecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid request body: {exc}") from exc

    # Validate preset_slug
    preset = _PRESETS.get(body.preset_slug)
    if preset is None:
        raise HTTPException(status_code=422, detail=f"Unknown preset_slug: '{body.preset_slug}'")

    # Validate geometry
    building = parse_polygon(body.geometry)
    if building is None:
        raise HTTPException(status_code=422, detail="Invalid geometry: expected a valid GeoJSON Polygon")

    # Load layer data
    cadastral_layer = data_store.get_layer("cadastral")
    zones_layer = data_store.get_layer("protection_zones")

    conflicts: list[Conflict] = []

    # Check zone intersections
    if zones_layer is not None:
        conflicts.extend(check_zone_intersections(building, zones_layer.features))

    # Check cadastral containment
    if cadastral_layer is not None:
        conflicts.extend(check_cadastral_within(building, cadastral_layer.features))

    # Check setback violations
    if zones_layer is not None:
        conflicts.extend(check_setback_violations(building, zones_layer.features, preset.setback_m))

    response = ValidateResponse(valid=len(conflicts) == 0, conflicts=conflicts)
    return {
        "valid": response.valid,
        "conflicts": [
            {
                "layer": c.layer,
                "type": c.type,
                "description": c.description,
                "overlap_area_m2": c.overlap_area_m2,
            }
            for c in response.conflicts
        ],
    }
