import { describe, expect, it } from 'vitest';

import {
  checkIntersection,
  checkWithinParcel,
  validatePlacement,
} from '@/validation/check-placement';

/**
 * Real coordinates near Innopolis (lon ~48.74, lat ~55.75).
 *
 * Cadastral parcel 001: SW [48.7378, 55.7520] → NE [48.7410, 55.7534]
 * Gas pipeline zone ZN-GAS-001: runs roughly through [48.7394, 55.7501] area
 */

/** Small building polygon (approx 10m x 10m) inside parcel 001, away from zones. */
function buildingInsideParcel(): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [48.7390, 55.7525],
        [48.7392, 55.7525],
        [48.7392, 55.7527],
        [48.7390, 55.7527],
        [48.7390, 55.7525],
      ],
    ],
  };
}

/** Small building polygon outside all parcels. */
function buildingOutsideAllParcels(): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [48.7600, 55.7600],
        [48.7602, 55.7600],
        [48.7602, 55.7602],
        [48.7600, 55.7602],
        [48.7600, 55.7600],
      ],
    ],
  };
}

/**
 * Cadastral parcels FeatureCollection matching real data structure.
 * Parcel 001: SW [48.7378, 55.7520] → NE [48.7410, 55.7534]
 */
function makeCadastralParcels(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          cadnum: '16:52:080101:001',
          area_m2: 30000,
          category: 'lands_of_settlements',
          permitted_use: 'residential_building',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [48.737822966507174, 55.75202120014373],
              [48.74101275917065, 55.75202120014373],
              [48.74101275917065, 55.75336866690621],
              [48.737822966507174, 55.75336866690621],
              [48.737822966507174, 55.75202120014373],
            ],
          ],
        },
      },
    ],
  };
}

/**
 * Protection zone that covers the area around the gas pipeline.
 * This zone overlaps with parcel 001 in the southern part.
 */
function makeProtectionZones(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          zone_id: 'ZN-GAS-001',
          zone_type: 'gas_pipeline',
          description: 'Gas pipeline protection zone (50m buffer)',
          buffer_m: 50,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [48.7380, 55.7518],
              [48.7415, 55.7518],
              [48.7415, 55.7523],
              [48.7380, 55.7523],
              [48.7380, 55.7518],
            ],
          ],
        },
      },
    ],
  };
}

/** Building polygon that overlaps with the gas pipeline zone. */
function buildingInZone(): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [48.7390, 55.7520],
        [48.7392, 55.7520],
        [48.7392, 55.7522],
        [48.7390, 55.7522],
        [48.7390, 55.7520],
      ],
    ],
  };
}

describe('checkIntersection', () => {
  it('returns true when building overlaps with zone', () => {
    const building = buildingInZone();
    const zone = makeProtectionZones().features[0]?.geometry as GeoJSON.Polygon;
    expect(checkIntersection(building, zone)).toBe(true);
  });

  it('returns false when building does not overlap with zone', () => {
    const building = buildingInsideParcel();
    const zone = makeProtectionZones().features[0]?.geometry as GeoJSON.Polygon;
    expect(checkIntersection(building, zone)).toBe(false);
  });

  it('handles MultiPolygon zones', () => {
    const building = buildingInZone();
    const multiZone: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [48.7380, 55.7518],
            [48.7415, 55.7518],
            [48.7415, 55.7523],
            [48.7380, 55.7523],
            [48.7380, 55.7518],
          ],
        ],
      ],
    };
    expect(checkIntersection(building, multiZone)).toBe(true);
  });
});

describe('checkWithinParcel', () => {
  it('returns true when building is inside a parcel', () => {
    const building = buildingInsideParcel();
    const parcels = makeCadastralParcels();
    expect(checkWithinParcel(building, parcels)).toBe(true);
  });

  it('returns false when building is outside all parcels', () => {
    const building = buildingOutsideAllParcels();
    const parcels = makeCadastralParcels();
    expect(checkWithinParcel(building, parcels)).toBe(false);
  });
});

describe('validatePlacement', () => {
  it('returns valid for a building inside a parcel with no zone conflicts', () => {
    const building = buildingInsideParcel();
    const result = validatePlacement(
      building,
      makeProtectionZones(),
      makeCadastralParcels(),
    );

    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('returns invalid when building intersects a protection zone', () => {
    const building = buildingInZone();
    const result = validatePlacement(
      building,
      makeProtectionZones(),
      makeCadastralParcels(),
    );

    expect(result.valid).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);

    const zoneConflict = result.conflicts.find(
      (c) => c.layer === 'protection_zones',
    );
    expect(zoneConflict).toBeDefined();
    expect(zoneConflict?.type).toBe('gas_pipeline');
  });

  it('returns invalid when building is outside all parcels', () => {
    const building = buildingOutsideAllParcels();
    const result = validatePlacement(
      building,
      makeProtectionZones(),
      makeCadastralParcels(),
    );

    expect(result.valid).toBe(false);
    const parcelConflict = result.conflicts.find(
      (c) => c.layer === 'cadastral',
    );
    expect(parcelConflict).toBeDefined();
    expect(parcelConflict?.type).toBe('outside_parcel');
  });

  it('returns multiple conflicts when building is both in zone and outside parcels', () => {
    /** Building inside zone but outside all parcels. */
    const building: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [48.7600, 55.7520],
          [48.7602, 55.7520],
          [48.7602, 55.7522],
          [48.7600, 55.7522],
          [48.7600, 55.7520],
        ],
      ],
    };

    /** Zone that covers the far-away building. */
    const zones: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            zone_id: 'ZN-TEST-001',
            zone_type: 'test_zone',
            description: 'Test zone',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [48.7599, 55.7519],
                [48.7603, 55.7519],
                [48.7603, 55.7523],
                [48.7599, 55.7523],
                [48.7599, 55.7519],
              ],
            ],
          },
        },
      ],
    };

    const result = validatePlacement(building, zones, makeCadastralParcels());

    expect(result.valid).toBe(false);
    expect(result.conflicts.length).toBe(2);

    const zoneConflict = result.conflicts.find(
      (c) => c.layer === 'protection_zones',
    );
    const parcelConflict = result.conflicts.find(
      (c) => c.layer === 'cadastral',
    );
    expect(zoneConflict).toBeDefined();
    expect(parcelConflict).toBeDefined();
  });
});
