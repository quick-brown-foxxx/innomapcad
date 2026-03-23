from __future__ import annotations

import msgspec


class HealthResponse(msgspec.Struct):
    """Response model for the health check endpoint."""

    status: str
    layers_loaded: int

    def to_dict(self) -> dict[str, str | int]:
        """Convert to a plain dict for JSON serialization."""
        return {"status": self.status, "layers_loaded": self.layers_loaded}


class Preset(msgspec.Struct, frozen=True):
    """Building preset with physical dimensions and display metadata."""

    slug: str
    name: str
    width_m: float
    length_m: float
    floors: int
    height_m: float
    setback_m: float
    color: str


class ValidateRequest(msgspec.Struct):
    """Request body for the validate endpoint."""

    geometry: dict[str, object]
    preset_slug: str


class Conflict(msgspec.Struct):
    """A single validation conflict."""

    layer: str
    type: str
    description: str
    overlap_area_m2: float | None


class ValidateResponse(msgspec.Struct):
    """Response model for the validate endpoint."""

    valid: bool
    conflicts: list[Conflict]
