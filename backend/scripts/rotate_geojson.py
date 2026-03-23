# /// script
# requires-python = ">=3.12"
# ///
"""Rotate all GeoJSON polygon geometries to match Innopolis's ~42.4° CW street grid."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import TypeAlias

# -- Constants ----------------------------------------------------------------

ROTATION_DEG: float = 42.4  # clockwise from north
LAT_REF: float = 55.75  # reference latitude for Innopolis
METERS_PER_DEG_LAT: float = 111_320.0
METERS_PER_DEG_LNG: float = METERS_PER_DEG_LAT * math.cos(math.radians(LAT_REF))

# Negative angle for clockwise rotation
THETA: float = math.radians(-ROTATION_DEG)
COS_T: float = math.cos(THETA)
SIN_T: float = math.sin(THETA)

DATA_DIR: Path = Path(__file__).resolve().parent.parent / "data"

Coord: TypeAlias = list[float]  # [lng, lat]
Ring: TypeAlias = list[Coord]
GeoJSON: TypeAlias = dict[str, object]


# -- Geometry helpers ---------------------------------------------------------


def centroid_of_ring(ring: Ring) -> tuple[float, float]:
    """Compute simple centroid of a ring (excluding closing vertex)."""
    # GeoJSON rings repeat the first vertex at the end — skip it.
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    n = len(pts)
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    return cx, cy


def rotate_point(lng: float, lat: float, c_lng: float, c_lat: float) -> tuple[float, float]:
    """Rotate (lng, lat) around (c_lng, c_lat) by THETA, accounting for latitude scaling."""
    dx_m = (lng - c_lng) * METERS_PER_DEG_LNG
    dy_m = (lat - c_lat) * METERS_PER_DEG_LAT

    new_dx = dx_m * COS_T - dy_m * SIN_T
    new_dy = dx_m * SIN_T + dy_m * COS_T

    new_lng = c_lng + new_dx / METERS_PER_DEG_LNG
    new_lat = c_lat + new_dy / METERS_PER_DEG_LAT
    return new_lng, new_lat


def rotate_ring(ring: Ring, c_lng: float, c_lat: float) -> Ring:
    """Rotate every coordinate in a ring around the given center."""
    return [[*rotate_point(p[0], p[1], c_lng, c_lat)] for p in ring]


def rotate_polygon(coords: list[Ring]) -> list[Ring]:
    """Rotate a Polygon's coordinate rings around the outer ring's centroid."""
    outer = coords[0]
    c_lng, c_lat = centroid_of_ring(outer)
    return [rotate_ring(ring, c_lng, c_lat) for ring in coords]


# -- Main --------------------------------------------------------------------


def process_file(path: Path) -> None:
    """Read a GeoJSON file, rotate all polygons, write back."""
    with path.open("r", encoding="utf-8") as f:
        data: GeoJSON = json.load(f)

    features = data.get("features")
    if not isinstance(features, list):
        print(f"  SKIP {path.name}: no features array")
        return

    for i, feat in enumerate(features):
        if not isinstance(feat, dict):
            continue
        geom = feat.get("geometry")
        if not isinstance(geom, dict):
            continue

        geom_type = geom.get("type")
        coords = geom.get("coordinates")
        if not isinstance(coords, list):
            continue

        props = feat.get("properties", {})
        label = props.get("cadnum") or props.get("zone_id") or f"feature[{i}]"  # type: ignore[union-attr]

        if geom_type == "Polygon":
            # Compute centroid before rotation for reporting
            outer_before: Ring = coords[0]
            cx, cy = centroid_of_ring(outer_before)
            geom["coordinates"] = rotate_polygon(coords)
            outer_after: Ring = geom["coordinates"][0]  # type: ignore[index]
            print(f"  {label}: centroid=({cx:.6f}, {cy:.6f})  first_coord=({outer_after[0][0]:.6f}, {outer_after[0][1]:.6f})")

        elif geom_type == "MultiPolygon":
            new_polys: list[list[Ring]] = []
            for poly_coords in coords:
                if isinstance(poly_coords, list):
                    new_polys.append(rotate_polygon(poly_coords))
            geom["coordinates"] = new_polys
            print(f"  {label}: MultiPolygon with {len(new_polys)} parts rotated")

    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"  -> wrote {path}")


def main() -> None:
    files = [
        DATA_DIR / "cadastral.geojson",
        DATA_DIR / "protection_zones.geojson",
    ]

    print(f"Rotation: {ROTATION_DEG}° clockwise")
    print(f"METERS_PER_DEG_LNG @ {LAT_REF}°N: {METERS_PER_DEG_LNG:.1f}")
    print(f"METERS_PER_DEG_LAT: {METERS_PER_DEG_LAT:.1f}")
    print()

    for path in files:
        print(f"Processing {path.name}:")
        if not path.exists():
            print(f"  ERROR: file not found: {path}")
            continue
        process_file(path)
        print()


if __name__ == "__main__":
    main()
