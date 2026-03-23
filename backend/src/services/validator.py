"""Validation logic for building geometry against protection zones and cadastral parcels.

Uses Shapely for geometry operations and pyproj for UTM projection (EPSG:32639).
"""

from shapely.geometry import shape
from shapely.geometry.polygon import Polygon
from shapely.ops import transform as shapely_transform
from typing_extensions import TypeIs

from src.models import Conflict
from src.services.data_store import Feature


def _is_list(value: object) -> TypeIs[list[object]]:
    """Narrow an unknown value to list[object]."""
    return isinstance(value, list)

# Lazy-init transformers to avoid import-time side effects in pyproj
_transformer_to_utm: object = None
_transformer_to_wgs: object = None


def _get_transformers() -> tuple[object, object]:
    """Return (to_utm, to_wgs) Transformer pair, creating on first call."""
    global _transformer_to_utm, _transformer_to_wgs
    if _transformer_to_utm is None:
        from pyproj import Transformer

        _transformer_to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32639", always_xy=True)
        _transformer_to_wgs = Transformer.from_crs("EPSG:32639", "EPSG:4326", always_xy=True)
    return _transformer_to_utm, _transformer_to_wgs


def parse_polygon(geojson: dict[str, object]) -> Polygon | None:
    """Convert a GeoJSON geometry dict to a Shapely Polygon, or None if invalid."""
    geom_type = geojson.get("type")
    if geom_type != "Polygon":
        return None
    coords_raw = geojson.get("coordinates")
    if not _is_list(coords_raw):
        return None
    if len(coords_raw) == 0:
        return None
    first_ring_raw = coords_raw[0]
    if not _is_list(first_ring_raw):
        return None
    if len(first_ring_raw) < 4:
        return None
    try:
        geom = shape(geojson)
    except Exception:
        return None
    if not isinstance(geom, Polygon) or geom.is_empty or not geom.is_valid:
        return None
    return geom


def _project_to_utm(polygon: Polygon) -> Polygon:
    """Project a WGS84 polygon to UTM Zone 39N."""
    to_utm, _to_wgs = _get_transformers()
    from pyproj import Transformer

    assert isinstance(to_utm, Transformer)
    projected: object = shapely_transform(to_utm.transform, polygon)
    assert isinstance(projected, Polygon)
    return projected


def _project_to_wgs(polygon: Polygon) -> Polygon:
    """Project a UTM Zone 39N polygon back to WGS84."""
    _to_utm, to_wgs = _get_transformers()
    from pyproj import Transformer

    assert isinstance(to_wgs, Transformer)
    projected: object = shapely_transform(to_wgs.transform, polygon)
    assert isinstance(projected, Polygon)
    return projected


def _compute_overlap_area_m2(building: Polygon, zone: Polygon) -> float:
    """Compute intersection area in square meters using UTM projection."""
    intersection: object = building.intersection(zone)
    if not isinstance(intersection, Polygon):
        return 0.0
    if intersection.is_empty:
        return 0.0
    utm_intersection = _project_to_utm(intersection)
    area: float = utm_intersection.area
    return area


def check_zone_intersections(
    building: Polygon,
    zone_features: list[Feature],
) -> list[Conflict]:
    """Check if building intersects any protection zone."""
    conflicts: list[Conflict] = []
    for feature in zone_features:
        zone_geom = parse_polygon(feature.geometry)
        if zone_geom is None:
            continue
        if building.intersects(zone_geom):
            overlap_m2 = _compute_overlap_area_m2(building, zone_geom)
            zone_id = str(feature.properties.get("zone_id", "unknown"))
            zone_type = str(feature.properties.get("zone_type", "unknown"))
            conflicts.append(
                Conflict(
                    layer="protection_zones",
                    type="zone_intersection",
                    description=f"Building intersects {zone_type} zone ({zone_id})",
                    overlap_area_m2=round(overlap_m2, 2),
                )
            )
    return conflicts


def check_cadastral_within(
    building: Polygon,
    cadastral_features: list[Feature],
) -> list[Conflict]:
    """Check if building is within at least one cadastral parcel."""
    for feature in cadastral_features:
        parcel_geom = parse_polygon(feature.geometry)
        if parcel_geom is None:
            continue
        if parcel_geom.contains(building):
            return []
    return [
        Conflict(
            layer="cadastral",
            type="outside_parcel",
            description="Building is not fully within any cadastral parcel",
            overlap_area_m2=None,
        )
    ]


def check_setback_violations(
    building: Polygon,
    zone_features: list[Feature],
    setback_m: float,
) -> list[Conflict]:
    """Check if buffered building (by setback_m) intersects protection zones.

    Uses pyproj UTM (EPSG:32639) for metric buffer accuracy.
    Only reports zones that the building does NOT already directly intersect
    (direct intersections are reported by check_zone_intersections).
    """
    utm_building = _project_to_utm(building)
    buffered_utm_geom: object = utm_building.buffer(setback_m)
    assert isinstance(buffered_utm_geom, Polygon)
    # Project buffered polygon back to WGS84
    buffered_wgs = _project_to_wgs(buffered_utm_geom)

    conflicts: list[Conflict] = []
    for feature in zone_features:
        zone_geom = parse_polygon(feature.geometry)
        if zone_geom is None:
            continue
        # Skip zones the building directly intersects (already reported)
        if building.intersects(zone_geom):
            continue
        if buffered_wgs.intersects(zone_geom):
            zone_id = str(feature.properties.get("zone_id", "unknown"))
            zone_type = str(feature.properties.get("zone_type", "unknown"))
            conflicts.append(
                Conflict(
                    layer="protection_zones",
                    type="setback_violation",
                    description=f"Building within {setback_m}m setback of {zone_type} zone ({zone_id})",
                    overlap_area_m2=None,
                )
            )
    return conflicts
