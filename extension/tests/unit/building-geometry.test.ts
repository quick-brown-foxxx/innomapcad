import { describe, expect, it } from 'vitest';

import { createBuildingPolygon } from '@/utils/building-geometry';

describe('createBuildingPolygon', () => {
  const center: readonly [number, number] = [49.2205, 55.7520];
  const widthM = 24;
  const lengthM = 60;

  it('returns a GeoJSON Polygon', () => {
    const polygon = createBuildingPolygon(center, widthM, lengthM);
    expect(polygon.type).toBe('Polygon');
    expect(polygon.coordinates).toHaveLength(1);
  });

  it('creates a closed ring with 5 coordinates', () => {
    const polygon = createBuildingPolygon(center, widthM, lengthM);
    const ring = polygon.coordinates[0];
    expect(ring).toHaveLength(5);

    // First and last coordinates must be identical (closed ring)
    const first = ring[0];
    const last = ring[4];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first !== undefined && last !== undefined) {
      expect(first[0]).toBe(last[0]);
      expect(first[1]).toBe(last[1]);
    }
  });

  it('center is approximately at the given coordinates', () => {
    const polygon = createBuildingPolygon(center, widthM, lengthM);
    const ring = polygon.coordinates[0];

    // Calculate centroid of the 4 corner points (exclude closing duplicate)
    let sumLng = 0;
    let sumLat = 0;
    for (let i = 0; i < 4; i++) {
      const coord = ring[i];
      if (coord !== undefined) {
        sumLng += coord[0];
        sumLat += coord[1];
      }
    }
    const centroidLng = sumLng / 4;
    const centroidLat = sumLat / 4;

    // Should be very close to the input center
    expect(Math.abs(centroidLng - center[0])).toBeLessThan(1e-10);
    expect(Math.abs(centroidLat - center[1])).toBeLessThan(1e-10);
  });

  it('creates a rectangle with correct approximate dimensions', () => {
    const polygon = createBuildingPolygon(center, widthM, lengthM);
    const ring = polygon.coordinates[0];

    // ring: [SW, SE, NE, NW, SW]
    const sw = ring[0];
    const se = ring[1];
    const ne = ring[2];

    expect(sw).toBeDefined();
    expect(se).toBeDefined();
    expect(ne).toBeDefined();

    if (sw === undefined || se === undefined || ne === undefined) {
      return;
    }

    // East-west extent (width) in degrees -> meters
    const metersPerDegLng = 111_320 * Math.cos((55.75 * Math.PI) / 180);
    const actualWidthM = Math.abs(se[0] - sw[0]) * metersPerDegLng;

    // North-south extent (length) in degrees -> meters
    const metersPerDegLat = 111_320;
    const actualLengthM = Math.abs(ne[1] - se[1]) * metersPerDegLat;

    // Allow 0.1m tolerance for floating point
    expect(Math.abs(actualWidthM - widthM)).toBeLessThan(0.1);
    expect(Math.abs(actualLengthM - lengthM)).toBeLessThan(0.1);
  });
});
