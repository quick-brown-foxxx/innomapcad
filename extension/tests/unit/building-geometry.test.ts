import { describe, expect, it } from 'vitest';

import {
  createBuildingPolygon,
  createRotatedBuildingPolygon,
} from '@/utils/building-geometry';

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

describe('createRotatedBuildingPolygon', () => {
  const center: readonly [number, number] = [49.2205, 55.752];
  const widthM = 24;
  const lengthM = 60;

  it('returns same polygon as createBuildingPolygon when rotation is 0', () => {
    const unrotated = createBuildingPolygon(center, widthM, lengthM);
    const rotated = createRotatedBuildingPolygon(center, widthM, lengthM, 0);

    expect(rotated.type).toBe('Polygon');
    expect(rotated.coordinates).toHaveLength(1);

    const unrotatedRing = unrotated.coordinates[0];
    const rotatedRing = rotated.coordinates[0];

    expect(rotatedRing).toHaveLength(unrotatedRing.length);

    for (let i = 0; i < unrotatedRing.length; i++) {
      const uc = unrotatedRing[i];
      const rc = rotatedRing[i];
      if (uc !== undefined && rc !== undefined) {
        expect(rc[0]).toBeCloseTo(uc[0], 12);
        expect(rc[1]).toBeCloseTo(uc[1], 12);
      }
    }
  });

  it('preserves centroid after rotation', () => {
    const polygon = createRotatedBuildingPolygon(center, widthM, lengthM, 45);
    const ring = polygon.coordinates[0];

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

    expect(Math.abs(centroidLng - center[0])).toBeLessThan(1e-10);
    expect(Math.abs(centroidLat - center[1])).toBeLessThan(1e-10);
  });

  it('rotates 90 degrees — corners differ from unrotated', () => {
    const unrotated = createBuildingPolygon(center, widthM, lengthM);
    const rotated = createRotatedBuildingPolygon(center, widthM, lengthM, 90);

    const unrotatedRing = unrotated.coordinates[0];
    const rotatedRing = rotated.coordinates[0];

    // For a non-square rectangle (24x60), 90° rotation must move corners
    let cornersDiffer = false;
    for (let i = 0; i < 4; i++) {
      const uc = unrotatedRing[i];
      const rc = rotatedRing[i];
      if (uc !== undefined && rc !== undefined) {
        if (
          Math.abs(uc[0] - rc[0]) > 1e-10 ||
          Math.abs(uc[1] - rc[1]) > 1e-10
        ) {
          cornersDiffer = true;
        }
      }
    }
    expect(cornersDiffer).toBe(true);
  });

  it('360 degree rotation returns to original position', () => {
    const unrotated = createBuildingPolygon(center, widthM, lengthM);
    const rotated = createRotatedBuildingPolygon(center, widthM, lengthM, 360);

    const unrotatedRing = unrotated.coordinates[0];
    const rotatedRing = rotated.coordinates[0];

    for (let i = 0; i < unrotatedRing.length; i++) {
      const uc = unrotatedRing[i];
      const rc = rotatedRing[i];
      if (uc !== undefined && rc !== undefined) {
        expect(rc[0]).toBeCloseTo(uc[0], 10);
        expect(rc[1]).toBeCloseTo(uc[1], 10);
      }
    }
  });

  it('creates a closed ring', () => {
    const polygon = createRotatedBuildingPolygon(center, widthM, lengthM, 30);
    const ring = polygon.coordinates[0];

    expect(ring).toHaveLength(5);

    const first = ring[0];
    const last = ring[4];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (first !== undefined && last !== undefined) {
      expect(first[0]).toBe(last[0]);
      expect(first[1]).toBe(last[1]);
    }
  });
});
