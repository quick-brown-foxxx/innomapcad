"""Building presets router."""

from __future__ import annotations

from typing import Final

from fastapi import APIRouter

from src.models import Preset

router: APIRouter = APIRouter(prefix="/api/v1")

_PRESETS: Final[list[Preset]] = [
    Preset(
        slug="residential",
        name="Жилой дом",
        width_m=24,
        length_m=60,
        floors=9,
        height_m=27,
        setback_m=5,
        color="#4A90D9",
    ),
    Preset(
        slug="office",
        name="Офисное здание",
        width_m=30,
        length_m=50,
        floors=5,
        height_m=17.5,
        setback_m=3,
        color="#50C878",
    ),
    Preset(
        slug="transformer",
        name="ТП",
        width_m=6,
        length_m=4,
        floors=1,
        height_m=3,
        setback_m=10,
        color="#FFD700",
    ),
    Preset(
        slug="parking",
        name="Парковка",
        width_m=40,
        length_m=20,
        floors=1,
        height_m=3,
        setback_m=5,
        color="#808080",
    ),
    Preset(
        slug="warehouse",
        name="Склад",
        width_m=50,
        length_m=30,
        floors=1,
        height_m=8,
        setback_m=5,
        color="#CD853F",
    ),
]


@router.get("/presets")
async def list_presets() -> list[dict[str, str | float | int]]:
    """Return all building presets."""
    return [msgspec_struct_to_dict(p) for p in _PRESETS]


def msgspec_struct_to_dict(preset: Preset) -> dict[str, str | float | int]:
    """Convert a Preset struct to a plain dict for JSON serialization."""
    return {
        "slug": preset.slug,
        "name": preset.name,
        "width_m": preset.width_m,
        "length_m": preset.length_m,
        "floors": preset.floors,
        "height_m": preset.height_m,
        "setback_m": preset.setback_m,
        "color": preset.color,
    }
