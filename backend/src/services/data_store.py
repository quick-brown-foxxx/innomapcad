"""In-memory GeoJSON data store.

Loads cadastral parcels and protection zones from disk at startup
and holds them for the lifetime of the application.
"""

from __future__ import annotations

from pathlib import Path
from typing import Final

import msgspec

_DATA_DIR: Final[Path] = Path(__file__).resolve().parent.parent.parent / "data"


class Feature(msgspec.Struct):
    """A single GeoJSON Feature."""

    type: str
    geometry: dict[str, object]
    properties: dict[str, object]


class FeatureCollection(msgspec.Struct):
    """A GeoJSON FeatureCollection."""

    type: str
    features: list[Feature]


class DataStore:
    """Holds loaded GeoJSON layers in memory."""

    def __init__(self) -> None:
        self._layers: dict[str, FeatureCollection] = {}

    @property
    def layers_loaded(self) -> int:
        """Return the number of loaded layers."""
        return len(self._layers)

    def get_layer(self, name: str) -> FeatureCollection | None:
        """Return a layer by name, or None if not found."""
        return self._layers.get(name)

    def layer_names(self) -> list[str]:
        """Return sorted list of loaded layer names."""
        return sorted(self._layers)

    def load_from_directory(self, data_dir: Path | None = None) -> None:
        """Load all expected GeoJSON files from the data directory.

        Args:
            data_dir: Override directory. Defaults to backend/data/.
        """
        directory = data_dir or _DATA_DIR
        layer_files: dict[str, str] = {
            "cadastral": "cadastral.geojson",
            "protection_zones": "protection_zones.geojson",
        }
        for layer_name, filename in layer_files.items():
            path = directory / filename
            raw_bytes = path.read_bytes()
            collection = msgspec.json.decode(raw_bytes, type=FeatureCollection)
            self._layers[layer_name] = collection


# Module-level singleton used via app state / dependency injection.
data_store: Final[DataStore] = DataStore()
