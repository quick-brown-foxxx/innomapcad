from __future__ import annotations

import msgspec


class HealthResponse(msgspec.Struct):
    """Response model for the health check endpoint."""

    status: str
    layers_loaded: int

    def to_dict(self) -> dict[str, str | int]:
        """Convert to a plain dict for JSON serialization."""
        return {"status": self.status, "layers_loaded": self.layers_loaded}
