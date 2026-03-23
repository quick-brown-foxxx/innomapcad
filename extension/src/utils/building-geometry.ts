/**
 * Pure function to create a rectangular building polygon in WGS-84 coordinates.
 * Converts meter dimensions to approximate degree offsets at Innopolis latitude.
 */

/** Meters per degree of latitude. */
const METERS_PER_DEG_LAT = 111_320;

/** Approximate meters per degree of longitude at Innopolis (~55.75 N). */
const INNOPOLIS_LAT_RAD = (55.75 * Math.PI) / 180;
const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * Math.cos(INNOPOLIS_LAT_RAD);

export interface GeoJsonPolygon {
  readonly type: 'Polygon';
  readonly coordinates: readonly [ReadonlyArray<readonly [number, number]>];
}

/**
 * Creates a GeoJSON Polygon rectangle centered on the given point.
 *
 * @param center - [longitude, latitude] of the center point
 * @param widthM - width of the building in meters (east-west extent)
 * @param lengthM - length of the building in meters (north-south extent)
 * @returns A GeoJSON Polygon with a closed ring (5 coordinates)
 */
export function createBuildingPolygon(
  center: readonly [number, number],
  widthM: number,
  lengthM: number,
): GeoJsonPolygon {
  const [lng, lat] = center;

  const halfWidthDeg = widthM / 2 / METERS_PER_DEG_LNG;
  const halfLengthDeg = lengthM / 2 / METERS_PER_DEG_LAT;

  const west = lng - halfWidthDeg;
  const east = lng + halfWidthDeg;
  const south = lat - halfLengthDeg;
  const north = lat + halfLengthDeg;

  // Closed ring: SW -> SE -> NE -> NW -> SW
  const ring: ReadonlyArray<readonly [number, number]> = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

/**
 * Creates a GeoJSON Polygon rectangle centered on the given point, rotated
 * clockwise by the specified number of degrees.
 *
 * @param center - [longitude, latitude] of the center point
 * @param widthM - width of the building in meters (east-west extent before rotation)
 * @param lengthM - length of the building in meters (north-south extent before rotation)
 * @param rotationDeg - clockwise rotation in degrees
 * @returns A GeoJSON Polygon with a closed ring (5 coordinates)
 */
export function createRotatedBuildingPolygon(
  center: readonly [number, number],
  widthM: number,
  lengthM: number,
  rotationDeg: number,
): GeoJsonPolygon {
  if (rotationDeg === 0) {
    return createBuildingPolygon(center, widthM, lengthM);
  }

  const [lng, lat] = center;

  const halfW = widthM / 2;
  const halfL = lengthM / 2;

  // Corner offsets in meter-space (relative to center)
  // Order: SW, SE, NE, NW (matching createBuildingPolygon)
  const cornersM: ReadonlyArray<readonly [number, number]> = [
    [-halfW, -halfL],
    [halfW, -halfL],
    [halfW, halfL],
    [-halfW, halfL],
  ] as const;

  // Clockwise rotation: x' = x*cos + y*sin, y' = -x*sin + y*cos
  const rad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  const rotatedCorners: Array<readonly [number, number]> = cornersM.map(
    ([mx, my]) => {
      const rx = mx * cosR + my * sinR;
      const ry = -mx * sinR + my * cosR;

      // Convert meter offsets to degree offsets and add to center
      const lngOffset = rx / METERS_PER_DEG_LNG;
      const latOffset = ry / METERS_PER_DEG_LAT;

      return [lng + lngOffset, lat + latOffset] as const;
    },
  );

  // Close the ring
  const first = rotatedCorners[0];
  if (first === undefined) {
    throw new Error('Invariant: corner array is empty');
  }

  const ring: ReadonlyArray<readonly [number, number]> = [
    ...rotatedCorners,
    first,
  ];

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}
