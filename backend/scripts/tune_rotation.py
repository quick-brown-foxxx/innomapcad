# /// script
# requires-python = ">=3.12"
# ///
"""Interactive GeoJSON rotation tuner.

Reads ORIGINAL (unrotated) data from git, applies a rotation angle,
writes to backend/data/, and restarts the backend so you can see
changes in the browser immediately.

Usage:
    uv run backend/scripts/tune_rotation.py              # interactive mode
    uv run backend/scripts/tune_rotation.py 42.4          # one-shot with angle
    uv run backend/scripts/tune_rotation.py --reset        # restore original unrotated data
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path
from typing import TypeAlias

# -- Types -------------------------------------------------------------------

Coord: TypeAlias = list[float]
Ring: TypeAlias = list[Coord]
GeoJSON: TypeAlias = dict[str, object]

# -- Constants ---------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "backend" / "data"
FILES = ["cadastral.geojson", "protection_zones.geojson"]

LAT_REF = 55.75
METERS_PER_DEG_LAT = 111_320.0
METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * math.cos(math.radians(LAT_REF))


# -- Git helpers -------------------------------------------------------------


def read_original(filename: str) -> GeoJSON:
    """Read the unrotated original from the last git commit."""
    result = subprocess.run(
        ["git", "show", f"HEAD:backend/data/{filename}"],
        capture_output=True,
        text=True,
        cwd=ROOT,
        check=True,
    )
    return json.loads(result.stdout)  # type: ignore[return-value]


# -- Geometry ----------------------------------------------------------------


def centroid(ring: Ring) -> tuple[float, float]:
    pts = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring
    n = len(pts)
    return sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n


def rotate_point(
    lng: float, lat: float, cx: float, cy: float, cos_t: float, sin_t: float
) -> list[float]:
    dx = (lng - cx) * METERS_PER_DEG_LNG
    dy = (lat - cy) * METERS_PER_DEG_LAT
    return [
        cx + (dx * cos_t - dy * sin_t) / METERS_PER_DEG_LNG,
        cy + (dx * sin_t + dy * cos_t) / METERS_PER_DEG_LAT,
    ]


def rotate_polygon(
    coords: list[Ring], cos_t: float, sin_t: float
) -> list[Ring]:
    cx, cy = centroid(coords[0])
    return [
        [rotate_point(p[0], p[1], cx, cy, cos_t, sin_t) for p in ring]
        for ring in coords
    ]


def rotate_geojson(data: GeoJSON, angle_deg: float) -> GeoJSON:
    """Rotate all polygons in a GeoJSON FeatureCollection."""
    theta = math.radians(-angle_deg)  # negative = clockwise
    cos_t, sin_t = math.cos(theta), math.sin(theta)

    features = data.get("features")
    if not isinstance(features, list):
        return data

    for feat in features:
        if not isinstance(feat, dict):
            continue
        geom = feat.get("geometry")
        if not isinstance(geom, dict):
            continue

        coords = geom.get("coordinates")
        if not isinstance(coords, list):
            continue

        if geom.get("type") == "Polygon":
            geom["coordinates"] = rotate_polygon(coords, cos_t, sin_t)
        elif geom.get("type") == "MultiPolygon":
            geom["coordinates"] = [
                rotate_polygon(poly, cos_t, sin_t)
                for poly in coords
                if isinstance(poly, list)
            ]

    return data


# -- File I/O ----------------------------------------------------------------


def write_geojson(filename: str, data: GeoJSON) -> None:
    path = DATA_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def apply_angle(angle_deg: float) -> None:
    """Read originals from git, rotate, write to disk."""
    for filename in FILES:
        original = read_original(filename)
        if angle_deg == 0.0:
            write_geojson(filename, original)
        else:
            rotated = rotate_geojson(original, angle_deg)
            write_geojson(filename, rotated)

    n_cad = len(read_original(FILES[0]).get("features", []))  # type: ignore[arg-type]
    n_pz = len(read_original(FILES[1]).get("features", []))  # type: ignore[arg-type]
    print(f"  Wrote {n_cad} cadastral + {n_pz} protection zone features")
    print(f"  -> {DATA_DIR}/")


def restart_backend() -> None:
    """Kill and restart the FastAPI backend so it reloads data."""
    # Kill existing uvicorn
    subprocess.run(
        ["pkill", "-f", "uvicorn.*main:app"],
        capture_output=True,
        cwd=ROOT,
    )
    # Start fresh in background
    subprocess.Popen(
        ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=ROOT / "backend",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print("  Backend restarted on :8000 (reload the extension page)")


# -- Main --------------------------------------------------------------------


def interactive_loop() -> None:
    print("=" * 60)
    print("  GeoJSON Rotation Tuner")
    print("  Innopolis grid is ~42-47 deg CW from north")
    print("=" * 60)
    print()
    print("Commands:")
    print("  <number>   - apply rotation (e.g. 42.4)")
    print("  r          - restart backend (after applying)")
    print("  q          - quit")
    print()

    while True:
        try:
            raw = input("angle> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if raw in ("q", "quit", "exit"):
            break

        if raw in ("r", "restart"):
            restart_backend()
            continue

        try:
            angle = float(raw)
        except ValueError:
            print(f"  Invalid input: {raw!r}")
            continue

        print(f"  Rotating {angle}° clockwise...")
        apply_angle(angle)
        restart_backend()
        print()


def main() -> None:
    args = sys.argv[1:]

    if not args:
        interactive_loop()
        return

    if args[0] == "--reset":
        print("Restoring original (unrotated) data...")
        apply_angle(0.0)
        restart_backend()
        return

    try:
        angle = float(args[0])
    except ValueError:
        print(f"Usage: {sys.argv[0]} [angle_degrees | --reset]")
        sys.exit(1)

    print(f"Rotating {angle}° clockwise...")
    apply_angle(angle)
    restart_backend()


if __name__ == "__main__":
    main()
