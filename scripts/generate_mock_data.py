#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.12"
# dependencies = ["shapely>=2.0.0"]
# ///
"""Generate realistic mock GeoJSON data for InnoMapCAD.

Produces cadastral parcels and protection zones around Innopolis
as GeoJSON files suitable for development and testing.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Final

from shapely.geometry import LineString, MultiPolygon, Polygon, mapping
from shapely.validation import make_valid

# Innopolis center coordinates (WGS-84)
CENTER_LON: Final = 48.745
CENTER_LAT: Final = 55.750

# Approximate degrees-per-meter at Innopolis latitude
# 1 degree lat ~ 111_320 m, 1 degree lon ~ 111_320 * cos(55.75) ~ 62_700 m
DEG_PER_M_LAT: Final = 1.0 / 111_320.0
DEG_PER_M_LON: Final = 1.0 / 62_700.0

OUTPUT_DIR: Final = Path(__file__).resolve().parent.parent / "backend" / "data"


def meters_to_deg(dx_m: float, dy_m: float) -> tuple[float, float]:
    """Convert meter offsets to approximate degree offsets at Innopolis latitude."""
    return dx_m * DEG_PER_M_LON, dy_m * DEG_PER_M_LAT


def make_rect(cx: float, cy: float, w_m: float, h_m: float) -> Polygon:
    """Create a rectangular polygon centered at (cx, cy) with dimensions in meters."""
    dw, dh = meters_to_deg(w_m / 2, h_m / 2)
    return Polygon([
        (cx - dw, cy - dh),
        (cx + dw, cy - dh),
        (cx + dw, cy + dh),
        (cx - dw, cy + dh),
        (cx - dw, cy - dh),
    ])


def validate_geometry(geom: Polygon | MultiPolygon) -> Polygon | MultiPolygon:
    """Ensure geometry is valid; fix if necessary."""
    if not geom.is_valid:
        geom = make_valid(geom)
    if not geom.is_valid:
        msg = f"Geometry still invalid after make_valid: {geom.wkt[:80]}"
        raise ValueError(msg)
    return geom


def generate_cadastral_parcels() -> list[dict[str, object]]:
    """Generate a grid of cadastral parcels around Innopolis center."""
    parcels: list[dict[str, object]] = []

    # 3x3 grid of parcels, ~200m x 150m each, with 30m gaps
    parcel_specs: list[tuple[str, float, float, float, float, str, str]] = [
        # (cadnum, offset_x_m, offset_y_m, width_m, height_m, category, permitted_use)
        ("16:52:080101:001", -350, 300, 200, 150, "lands_of_settlements", "residential_building"),
        ("16:52:080101:002", -100, 300, 200, 150, "lands_of_settlements", "public_building"),
        ("16:52:080101:003", 150, 300, 200, 150, "lands_of_settlements", "residential_building"),
        ("16:52:080102:001", -350, 100, 200, 150, "lands_of_settlements", "commercial"),
        ("16:52:080102:002", -100, 100, 250, 150, "lands_of_settlements", "educational"),
        ("16:52:080102:003", 200, 100, 200, 150, "lands_of_settlements", "residential_building"),
        ("16:52:080103:001", -350, -100, 300, 200, "lands_of_industry", "industrial"),
        ("16:52:080103:002", 0, -100, 200, 200, "lands_of_settlements", "park_recreation"),
        ("16:52:080103:003", 250, -100, 150, 200, "lands_of_settlements", "residential_building"),
    ]

    for cadnum, ox, oy, w, h, category, use in parcel_specs:
        cx = CENTER_LON + ox * DEG_PER_M_LON
        cy = CENTER_LAT + oy * DEG_PER_M_LAT
        geom = make_rect(cx, cy, w, h)
        geom = validate_geometry(geom)

        area_m2 = round(w * h, 1)
        feature: dict[str, object] = {
            "type": "Feature",
            "properties": {
                "cadnum": cadnum,
                "area_m2": area_m2,
                "category": category,
                "permitted_use": use,
            },
            "geometry": mapping(geom),
        }
        parcels.append(feature)

    return parcels


def generate_protection_zones() -> list[dict[str, object]]:
    """Generate protection zones that cross some cadastral parcels."""
    zones: list[dict[str, object]] = []

    # Gas pipeline: runs N-S through the left side of the grid, crossing parcels 001
    gas_line = LineString([
        (CENTER_LON - 350 * DEG_PER_M_LON, CENTER_LAT - 400 * DEG_PER_M_LAT),
        (CENTER_LON - 300 * DEG_PER_M_LON, CENTER_LAT + 0 * DEG_PER_M_LAT),
        (CENTER_LON - 280 * DEG_PER_M_LON, CENTER_LAT + 500 * DEG_PER_M_LAT),
    ])
    gas_buffer = gas_line.buffer(50 * DEG_PER_M_LON)
    gas_buffer = validate_geometry(gas_buffer)
    zones.append({
        "type": "Feature",
        "properties": {
            "zone_id": "ZN-GAS-001",
            "zone_type": "gas_pipeline",
            "description": "Gas pipeline protection zone (50m buffer)",
            "buffer_m": 50,
        },
        "geometry": mapping(gas_buffer),
    })

    # Power line: runs E-W through the middle row, crossing parcels in row 2
    power_line = LineString([
        (CENTER_LON - 500 * DEG_PER_M_LON, CENTER_LAT + 100 * DEG_PER_M_LAT),
        (CENTER_LON + 0 * DEG_PER_M_LON, CENTER_LAT + 120 * DEG_PER_M_LAT),
        (CENTER_LON + 400 * DEG_PER_M_LON, CENTER_LAT + 110 * DEG_PER_M_LAT),
    ])
    power_buffer = power_line.buffer(25 * DEG_PER_M_LON)
    power_buffer = validate_geometry(power_buffer)
    zones.append({
        "type": "Feature",
        "properties": {
            "zone_id": "ZN-PWR-001",
            "zone_type": "power_line",
            "description": "Power line protection zone (25m buffer)",
            "buffer_m": 25,
        },
        "geometry": mapping(power_buffer),
    })

    # Water protection: along a river/lake at the south edge
    water_edge = LineString([
        (CENTER_LON - 600 * DEG_PER_M_LON, CENTER_LAT - 250 * DEG_PER_M_LAT),
        (CENTER_LON - 200 * DEG_PER_M_LON, CENTER_LAT - 280 * DEG_PER_M_LAT),
        (CENTER_LON + 200 * DEG_PER_M_LON, CENTER_LAT - 300 * DEG_PER_M_LAT),
        (CENTER_LON + 500 * DEG_PER_M_LON, CENTER_LAT - 260 * DEG_PER_M_LAT),
    ])
    water_buffer = water_edge.buffer(200 * DEG_PER_M_LON)
    water_buffer = validate_geometry(water_buffer)
    zones.append({
        "type": "Feature",
        "properties": {
            "zone_id": "ZN-WTR-001",
            "zone_type": "water_protection",
            "description": "Water body protection zone (200m buffer)",
            "buffer_m": 200,
        },
        "geometry": mapping(water_buffer),
    })

    return zones


def check_intersections(
    parcels: list[dict[str, object]],
    zones: list[dict[str, object]],
) -> None:
    """Print intersection report between parcels and zones."""
    intersected_count = 0
    clear_count = 0

    for parcel in parcels:
        parcel_geom = Polygon(parcel["geometry"]["coordinates"][0])  # type: ignore[index]  # rationale: known GeoJSON structure
        props = parcel["properties"]
        cadnum = props["cadnum"]  # type: ignore[index]  # rationale: known dict structure
        hits: list[str] = []

        for zone in zones:
            zone_geom_data = zone["geometry"]
            zone_type_val = zone_geom_data["type"]  # type: ignore[index]  # rationale: known GeoJSON structure
            if zone_type_val == "Polygon":
                zone_geom = Polygon(zone_geom_data["coordinates"][0])  # type: ignore[index]  # rationale: known GeoJSON structure
            else:
                zone_geom = MultiPolygon(
                    [Polygon(ring[0]) for ring in zone_geom_data["coordinates"]]  # type: ignore[index]  # rationale: known GeoJSON structure
                )

            zone_props = zone["properties"]
            if parcel_geom.intersects(zone_geom):
                hits.append(str(zone_props["zone_type"]))  # type: ignore[index]  # rationale: known dict structure

        if hits:
            intersected_count += 1
            print(f"  {cadnum}: intersected by {', '.join(hits)}")
        else:
            clear_count += 1
            print(f"  {cadnum}: CLEAR")

    print(f"\nSummary: {intersected_count} intersected, {clear_count} clear")
    if intersected_count < 2:
        print("WARNING: fewer than 2 parcels intersected by zones", file=sys.stderr)
    if clear_count < 2:
        print("WARNING: fewer than 2 parcels are clear of zones", file=sys.stderr)


def write_geojson(path: Path, features: list[dict[str, object]]) -> None:
    """Write a GeoJSON FeatureCollection to a file."""
    collection: dict[str, object] = {
        "type": "FeatureCollection",
        "features": features,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(features)} features to {path}")


def main() -> None:
    """Generate mock cadastral and protection zone GeoJSON files."""
    print("Generating cadastral parcels...")
    parcels = generate_cadastral_parcels()

    print("Generating protection zones...")
    zones = generate_protection_zones()

    print("\nIntersection analysis:")
    check_intersections(parcels, zones)

    cadastral_path = OUTPUT_DIR / "cadastral.geojson"
    zones_path = OUTPUT_DIR / "protection_zones.geojson"

    write_geojson(cadastral_path, parcels)
    write_geojson(zones_path, zones)

    print("\nDone.")


if __name__ == "__main__":
    main()
