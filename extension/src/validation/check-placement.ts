/**
 * Pure validation functions using Turf.js for building placement checks.
 * No browser dependencies — fully unit-testable.
 */

import { booleanIntersects, booleanWithin, polygon as turfPolygon, multiPolygon as turfMultiPolygon } from '@turf/turf';

import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import type { FeatureCollection as LocalFeatureCollection } from '@/lib/schemas';

export interface ValidationConflict {
  readonly layer: string;
  readonly type: string;
  readonly description: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly conflicts: readonly ValidationConflict[];
}

/**
 * Accepts both mutable and readonly coordinate arrays from GeoJSON polygon types.
 * This allows the local GeoJsonPolygon (readonly) and standard GeoJSON.Polygon (mutable).
 */
interface PolygonLike {
  readonly type: 'Polygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<readonly [number, number] | Position>>;
}

/**
 * Converts a possibly-readonly polygon coordinate array to a mutable one
 * suitable for Turf.js consumption.
 */
function toMutableCoords(
  coords: ReadonlyArray<ReadonlyArray<readonly [number, number] | Position>>,
): Position[][] {
  return coords.map((ring) => ring.map((pos) => [...pos]));
}

/**
 * Narrows a loose geometry object from the local schema to a typed Polygon or MultiPolygon.
 * Returns null if the geometry type does not match.
 */
function narrowGeometry(
  geom: { readonly type: string; readonly coordinates?: unknown },
): Polygon | MultiPolygon | null {
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    // The coordinates have been validated as GeoJSON by the backend;
    // we narrow the union here so Turf.js can consume them.
    return geom as unknown as Polygon | MultiPolygon;
  }
  return null;
}

/**
 * Checks whether a building polygon intersects with a zone polygon.
 * Returns true if the geometries overlap.
 */
export function checkIntersection(
  building: PolygonLike,
  zone: Polygon | MultiPolygon,
): boolean {
  const buildingFeature = turfPolygon(toMutableCoords(building.coordinates));

  const zoneFeature: Feature<Polygon | MultiPolygon> =
    zone.type === 'Polygon'
      ? turfPolygon(zone.coordinates)
      : turfMultiPolygon(zone.coordinates);

  return booleanIntersects(buildingFeature, zoneFeature);
}

/**
 * Checks whether a building polygon falls entirely within at least one
 * cadastral parcel in the collection.
 * Returns true if the building is within any parcel.
 */
export function checkWithinParcel(
  building: PolygonLike,
  parcels: LocalFeatureCollection,
): boolean {
  const buildingFeature = turfPolygon(toMutableCoords(building.coordinates));

  for (const feature of parcels.features) {
    const geom = narrowGeometry(feature.geometry);
    if (geom === null) {
      continue;
    }

    const parcelFeature: Feature<Polygon | MultiPolygon> =
      geom.type === 'Polygon'
        ? turfPolygon(geom.coordinates)
        : turfMultiPolygon(geom.coordinates);

    if (booleanWithin(buildingFeature, parcelFeature)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a building placement against protection zones and cadastral parcels.
 * Returns a result indicating whether placement is valid and any conflicts found.
 */
export function validatePlacement(
  building: PolygonLike,
  protectionZones: LocalFeatureCollection,
  cadastralParcels: LocalFeatureCollection,
): ValidationResult {
  const conflicts: ValidationConflict[] = [];

  // Check intersection with each protection zone
  for (const feature of protectionZones.features) {
    const zoneGeom = narrowGeometry(feature.geometry);
    if (zoneGeom === null) {
      continue;
    }

    if (checkIntersection(building, zoneGeom)) {
      const props = feature.properties;
      const zoneType = (props?.['zone_type'] as string | undefined) ?? 'unknown';
      const description =
        (props?.['description'] as string | undefined) ??
        `Intersects with ${zoneType} zone`;

      conflicts.push({
        layer: 'protection_zones',
        type: zoneType,
        description,
      });
    }
  }

  // Check if building is within a cadastral parcel
  if (!checkWithinParcel(building, cadastralParcels)) {
    conflicts.push({
      layer: 'cadastral',
      type: 'outside_parcel',
      description: 'Building is not within any cadastral parcel',
    });
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
